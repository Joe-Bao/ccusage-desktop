use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{self, BufRead, BufReader, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::ShellExt;

const CACHE_VERSION: u8 = 2;
const CACHE_TTL_SECONDS: u64 = 300;
const MAX_CACHE_ENTRIES: usize = 6;
const CCUSAGE_VERSION: &str = "20.0.19";
const RELEASES_URL: &str = "https://github.com/Joe-Bao/ccusage-desktop/releases";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UsageRequest {
    since: Option<String>,
    until: Option<String>,
    timezone: Option<String>,
    #[serde(default)]
    refresh: bool,
}

#[derive(Debug, Deserialize)]
struct SessionIndexEntry {
    id: String,
    thread_name: String,
}

#[derive(Debug, Default, Deserialize)]
struct CodexState {
    #[serde(rename = "local-projects", default)]
    local_projects: HashMap<String, LocalProject>,
    #[serde(rename = "thread-project-assignments", default)]
    thread_project_assignments: HashMap<String, ThreadProjectAssignment>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalProject {
    name: String,
    #[serde(default)]
    root_paths: Vec<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThreadProjectAssignment {
    project_id: String,
    cwd: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
struct SessionMetaLine {
    payload: SessionMetaPayload,
}

#[derive(Debug, Deserialize)]
struct SessionMetaPayload {
    cwd: Option<PathBuf>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheEntry {
    generated_at: u64,
    data: Value,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheStore {
    version: u8,
    entries: HashMap<String, CacheEntry>,
}

impl Default for CacheStore {
    fn default() -> Self {
        Self {
            version: CACHE_VERSION,
            entries: HashMap::new(),
        }
    }
}

#[derive(Default)]
struct CacheState {
    // ponytail: one lock is enough for one window; split per key if multi-window refreshes arrive.
    store: Mutex<Option<CacheStore>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UsageResponse {
    data: Value,
    cached: bool,
    stale: bool,
    generated_at: u64,
    cache_age_seconds: u64,
    duration_ms: u64,
    ccusage_version: &'static str,
    warning: Option<String>,
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn is_valid_date(value: &str) -> bool {
    if value.len() != 8 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return false;
    }

    let year = value[0..4].parse::<u32>().unwrap_or_default();
    let month = value[4..6].parse::<u32>().unwrap_or_default();
    let day = value[6..8].parse::<u32>().unwrap_or_default();
    let leap = year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };

    (1..=days).contains(&day)
}

fn validate_request(request: &UsageRequest) -> Result<(), String> {
    for (name, value) in [("since", &request.since), ("until", &request.until)] {
        if value.as_deref().is_some_and(|date| !is_valid_date(date)) {
            return Err(format!("{name} must be a valid YYYYMMDD date"));
        }
    }

    if let (Some(since), Some(until)) = (&request.since, &request.until)
        && since > until
    {
        return Err("since must not be later than until".into());
    }

    if request.timezone.as_deref().is_some_and(|timezone| {
        timezone.is_empty()
            || timezone.len() > 64
            || !timezone.bytes().all(|byte| {
                byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-' | b'+')
            })
    }) {
        return Err("timezone must be a valid IANA name".into());
    }

    Ok(())
}

fn cache_key(request: &UsageRequest) -> String {
    format!(
        "{}-{}-{}",
        request.since.as_deref().unwrap_or("start"),
        request.until.as_deref().unwrap_or("end"),
        request.timezone.as_deref().unwrap_or("local")
    )
}

fn codex_dir(app: &AppHandle) -> Option<PathBuf> {
    std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| app.path().home_dir().ok().map(|home| home.join(".codex")))
}

fn session_id(period: &str) -> Option<String> {
    let raw_filename = period
        .rsplit(|character| character == '/' || character == char::from(92))
        .next()?;
    let filename = raw_filename.strip_suffix(".jsonl").unwrap_or(raw_filename);
    let id = filename.get(filename.len().checked_sub(36)?..)?;
    let bytes = id.as_bytes();
    if bytes.len() != 36
        || bytes.iter().enumerate().any(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                *byte != b'-'
            } else {
                !byte.is_ascii_hexdigit()
            }
        })
    {
        return None;
    }
    Some(id.to_string())
}

fn load_session_titles(codex_dir: &Path) -> HashMap<String, String> {
    let Ok(contents) = fs::read_to_string(codex_dir.join("session_index.jsonl")) else {
        return HashMap::new();
    };
    contents
        .lines()
        .filter_map(|line| serde_json::from_str::<SessionIndexEntry>(line).ok())
        .map(|entry| (entry.id, entry.thread_name))
        .collect()
}

fn load_codex_state(codex_dir: &Path) -> CodexState {
    [".codex-global-state.json", ".codex-global-state.json.bak"]
        .into_iter()
        .find_map(|filename| {
            fs::read(codex_dir.join(filename))
                .ok()
                .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        })
        .unwrap_or_default()
}

fn safe_rollout_filename(period: &str) -> Option<String> {
    let raw_filename = period
        .rsplit(|character| character == '/' || character == char::from(92))
        .next()?;
    let filename = raw_filename.strip_suffix(".jsonl").unwrap_or(raw_filename);
    if !filename.starts_with("rollout-") {
        return None;
    }
    Some(format!("{filename}.jsonl"))
}

fn rollout_cwd(codex_dir: &Path, period: &str) -> Option<PathBuf> {
    let normalized = period.replace(char::from(92), "/");
    let parts = normalized.split('/').collect::<Vec<_>>();
    let filename = safe_rollout_filename(period)?;
    let mut candidates = Vec::with_capacity(2);
    if parts.len() == 4
        && parts[..3]
            .iter()
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
    {
        candidates.push(
            codex_dir
                .join("sessions")
                .join(parts[0])
                .join(parts[1])
                .join(parts[2])
                .join(&filename),
        );
    }
    candidates.push(codex_dir.join("archived_sessions").join(filename));

    candidates.into_iter().find_map(|path| {
        let line = BufReader::new(File::open(path).ok()?)
            .lines()
            .next()?
            .ok()?;
        serde_json::from_str::<SessionMetaLine>(&line)
            .ok()?
            .payload
            .cwd
    })
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('/', std::path::MAIN_SEPARATOR_STR)
        .trim_end_matches(std::path::MAIN_SEPARATOR)
        .to_lowercase()
}

fn project_name(state: &CodexState, session_id: &str, cwd: Option<&Path>) -> Option<String> {
    if let Some(project) = state
        .thread_project_assignments
        .get(session_id)
        .and_then(|assignment| state.local_projects.get(&assignment.project_id))
    {
        return Some(project.name.clone());
    }

    let cwd = cwd?;
    let normalized_cwd = normalize_path(cwd);
    state
        .local_projects
        .values()
        .flat_map(|project| {
            project.root_paths.iter().filter_map(|root| {
                let normalized_root = normalize_path(root);
                (!normalized_root.is_empty()
                    && (normalized_cwd == normalized_root
                        || normalized_cwd.starts_with(
                            &(normalized_root.clone() + std::path::MAIN_SEPARATOR_STR),
                        )))
                .then_some((normalized_root.len(), project.name.clone()))
            })
        })
        .max_by_key(|(length, _)| *length)
        .map(|(_, name)| name)
        .or_else(|| {
            cwd.file_name()
                .map(|name| name.to_string_lossy().into_owned())
        })
}

fn enrich_codex_sessions(codex_dir: &Path, data: &mut Value) {
    let titles = load_session_titles(codex_dir);
    let state = load_codex_state(codex_dir);
    let Some(sessions) = data.get_mut("session").and_then(Value::as_array_mut) else {
        return;
    };

    for session in sessions {
        if session.get("agent").and_then(Value::as_str) != Some("codex") {
            continue;
        }
        let Some(period) = session
            .get("period")
            .and_then(Value::as_str)
            .map(str::to_string)
        else {
            continue;
        };
        let Some(id) = session_id(&period) else {
            continue;
        };
        let cwd = state
            .thread_project_assignments
            .get(&id)
            .and_then(|assignment| assignment.cwd.clone())
            .or_else(|| rollout_cwd(codex_dir, &period));
        let project = project_name(&state, &id, cwd.as_deref());
        let metadata = session
            .as_object_mut()
            .expect("session rows are objects")
            .entry("metadata")
            .or_insert_with(|| Value::Object(Default::default()));
        if !metadata.is_object() {
            *metadata = Value::Object(Default::default());
        }
        let metadata = metadata.as_object_mut().expect("metadata initialized");
        if let Some(title) = titles.get(&id) {
            metadata.insert("title".into(), title.clone().into());
        }
        if let Some(project) = project {
            metadata.insert("project".into(), project.into());
        }
        if let Some(cwd) = cwd {
            metadata.insert("cwd".into(), cwd.to_string_lossy().into_owned().into());
        }
    }
}

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Cannot resolve cache directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Cannot create cache directory: {error}"))?;
    Ok(directory.join("usage-v1.json"))
}

fn read_store(path: &Path) -> CacheStore {
    let Ok(bytes) = fs::read(path) else {
        return CacheStore::default();
    };
    let Ok(store) = serde_json::from_slice::<CacheStore>(&bytes) else {
        return CacheStore::default();
    };

    if store.version == CACHE_VERSION {
        store
    } else {
        CacheStore::default()
    }
}

fn write_store(path: &Path, store: &CacheStore) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    let bytes =
        serde_json::to_vec(store).map_err(|error| format!("Cannot serialize cache: {error}"))?;
    let mut file = File::create(&temporary)
        .map_err(|error| format!("Cannot create temporary cache: {error}"))?;
    file.write_all(&bytes)
        .and_then(|()| file.sync_all())
        .map_err(|error| format!("Cannot write cache: {error}"))?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("Cannot replace cache: {error}"))?;
    }
    fs::rename(&temporary, path).map_err(|error| format!("Cannot finalize cache: {error}"))
}

fn get_cached(state: &CacheState, path: &Path, key: &str) -> Result<Option<CacheEntry>, String> {
    let mut guard = state
        .store
        .lock()
        .map_err(|_| "Cache lock was poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some(read_store(path));
    }
    Ok(guard
        .as_ref()
        .and_then(|store| store.entries.get(key).cloned()))
}

fn put_cached(
    state: &CacheState,
    path: &Path,
    key: String,
    entry: CacheEntry,
) -> Result<(), String> {
    let mut guard = state
        .store
        .lock()
        .map_err(|_| "Cache lock was poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some(read_store(path));
    }
    let store = guard.as_mut().expect("cache store initialized");
    store.entries.insert(key, entry);

    while store.entries.len() > MAX_CACHE_ENTRIES {
        let oldest = store
            .entries
            .iter()
            .min_by_key(|(_, value)| value.generated_at)
            .map(|(key, _)| key.clone());
        if let Some(oldest) = oldest {
            store.entries.remove(&oldest);
        }
    }

    write_store(path, store)
}

fn response_from_cache(
    entry: CacheEntry,
    stale: bool,
    started: Instant,
    warning: Option<String>,
) -> UsageResponse {
    let age = now_seconds().saturating_sub(entry.generated_at);
    UsageResponse {
        data: entry.data,
        cached: true,
        stale,
        generated_at: entry.generated_at,
        cache_age_seconds: age,
        duration_ms: started.elapsed().as_millis() as u64,
        ccusage_version: CCUSAGE_VERSION,
        warning,
    }
}

async fn run_ccusage(app: &AppHandle, request: &UsageRequest) -> Result<Value, String> {
    let mut arguments = vec![
        "daily".to_string(),
        "--sections".to_string(),
        "daily,session".to_string(),
        "--by-agent".to_string(),
        "--json".to_string(),
        "--offline".to_string(),
    ];
    if let Some(since) = &request.since {
        arguments.extend(["--since".into(), since.clone()]);
    }
    if let Some(until) = &request.until {
        arguments.extend(["--until".into(), until.clone()]);
    }
    if let Some(timezone) = &request.timezone {
        arguments.extend(["--timezone".into(), timezone.clone()]);
    }

    let output = app
        .shell()
        .sidecar("ccusage")
        .map_err(|error| format!("Cannot locate bundled ccusage: {error}"))?
        .args(arguments)
        .output()
        .await
        .map_err(|error| format!("Cannot start bundled ccusage: {error}"))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() {
            "ccusage exited without a diagnostic".into()
        } else {
            error
        });
    }

    let mut data = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("ccusage returned invalid JSON or UTF-8: {error}"))?;
    if let Some(codex_dir) = codex_dir(app) {
        enrich_codex_sessions(&codex_dir, &mut data);
    }
    Ok(data)
}

#[tauri::command]
async fn load_usage(
    app: AppHandle,
    state: State<'_, CacheState>,
    request: UsageRequest,
) -> Result<UsageResponse, String> {
    let started = Instant::now();
    validate_request(&request)?;
    let path = cache_path(&app)?;
    let key = cache_key(&request);
    let cached = get_cached(&state, &path, &key)?;

    if !request.refresh
        && let Some(entry) = cached.clone()
        && now_seconds().saturating_sub(entry.generated_at) <= CACHE_TTL_SECONDS
    {
        return Ok(response_from_cache(entry, false, started, None));
    }

    match run_ccusage(&app, &request).await {
        Ok(data) => {
            let entry = CacheEntry {
                generated_at: now_seconds(),
                data: data.clone(),
            };
            let warning = put_cached(&state, &path, key, entry.clone()).err();
            Ok(UsageResponse {
                data,
                cached: false,
                stale: false,
                generated_at: entry.generated_at,
                cache_age_seconds: 0,
                duration_ms: started.elapsed().as_millis() as u64,
                ccusage_version: CCUSAGE_VERSION,
                warning,
            })
        }
        Err(error) => match cached {
            Some(entry) => Ok(response_from_cache(entry, true, started, Some(error))),
            None => Err(error),
        },
    }
}

#[tauri::command]
fn clear_cache(app: AppHandle, state: State<'_, CacheState>) -> Result<(), String> {
    let path = cache_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Cannot remove cache: {error}")),
    }
    *state
        .store
        .lock()
        .map_err(|_| "Cache lock was poisoned".to_string())? = None;
    Ok(())
}

#[tauri::command]
#[allow(deprecated)]
fn open_releases(app: AppHandle) -> Result<(), String> {
    app.shell()
        .open(RELEASES_URL, None)
        .map_err(|error| format!("Cannot open releases page: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CacheState::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            load_usage,
            clear_cache,
            open_releases
        ])
        .run(tauri::generate_context!())
        .expect("error while running CCUsage Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_calendar_dates_and_order() {
        assert!(is_valid_date("20260228"));
        assert!(is_valid_date("20240229"));
        assert!(!is_valid_date("20260229"));
        assert!(!is_valid_date("20261301"));
        assert!(!is_valid_date("日期202608"));

        let reversed = UsageRequest {
            since: Some("20260813".into()),
            until: Some("20260812".into()),
            timezone: Some("Australia/Sydney".into()),
            refresh: false,
        };
        assert!(validate_request(&reversed).is_err());
    }

    #[test]
    fn enriches_codex_sessions_with_title_project_and_cwd() {
        let directory = std::env::temp_dir().join(format!(
            "ccusage-desktop-metadata-{}-{}",
            std::process::id(),
            now_seconds()
        ));
        let rollout_directory = directory.join("sessions/2026/08/13");
        fs::create_dir_all(&rollout_directory).expect("create rollout directory");
        fs::write(
            directory.join("session_index.jsonl"),
            r#"{"id":"019ff6bc-94df-7340-9327-7f6c26345d85","thread_name":"创建桌面看板","updated_at":"2026-08-13T00:00:00Z"}"#,
        )
        .expect("write title index");
        fs::write(
            directory.join(".codex-global-state.json"),
            r#"{"local-projects":{"project-1":{"name":"api","rootPaths":["D:/api"]}},"thread-project-assignments":{}}"#,
        )
        .expect("write project state");
        fs::write(
            rollout_directory
                .join("rollout-2026-08-13T00-00-00-019ff6bc-94df-7340-9327-7f6c26345d85.jsonl"),
            r#"{"type":"session_meta","payload":{"cwd":"D:/api"}}"#,
        )
        .expect("write rollout metadata");

        let mut data = json!({
            "session": [{
                "agent": "codex",
                "period": "2026/08/13/rollout-2026-08-13T00-00-00-019ff6bc-94df-7340-9327-7f6c26345d85",
                "metadata": {"lastActivity": "2026-08-13T00:00:00Z"}
            }]
        });
        enrich_codex_sessions(&directory, &mut data);
        let metadata = &data["session"][0]["metadata"];
        assert_eq!(metadata["title"], "创建桌面看板");
        assert_eq!(metadata["project"], "api");
        assert_eq!(metadata["cwd"], "D:/api");
        assert_eq!(metadata["lastActivity"], "2026-08-13T00:00:00Z");
        fs::remove_dir_all(directory).expect("remove metadata directory");
    }

    #[test]
    fn cache_round_trips_utf8_and_prunes_old_entries() {
        let directory = std::env::temp_dir().join(format!(
            "ccusage-desktop-{}-{}",
            std::process::id(),
            now_seconds()
        ));
        fs::create_dir_all(&directory).expect("create test cache directory");
        let path = directory.join("usage.json");
        let state = CacheState::default();

        for index in 0..=MAX_CACHE_ENTRIES {
            put_cached(
                &state,
                &path,
                format!("key-{index}"),
                CacheEntry {
                    generated_at: index as u64,
                    data: json!({"session": "中文会话 🚀", "index": index}),
                },
            )
            .expect("write cache");
        }

        let store = read_store(&path);
        assert_eq!(store.entries.len(), MAX_CACHE_ENTRIES);
        assert!(!store.entries.contains_key("key-0"));
        assert_eq!(store.entries["key-6"].data["session"], "中文会话 🚀");
        fs::remove_dir_all(directory).expect("remove test cache directory");
    }
}
