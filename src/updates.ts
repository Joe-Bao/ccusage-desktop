export const RELEASES_URL = "https://github.com/Joe-Bao/ccusage-desktop/releases";

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/Joe-Bao/ccusage-desktop/releases/latest";

function versionParts(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function isNewerVersion(current: string, candidate: string): boolean {
  const currentParts = versionParts(current);
  const candidateParts = versionParts(candidate);
  if (!currentParts || !candidateParts) return false;

  for (let index = 0; index < currentParts.length; index += 1) {
    if (candidateParts[index] !== currentParts[index]) {
      return candidateParts[index] > currentParts[index];
    }
  }
  return false;
}

export async function fetchLatestVersion(fetcher: typeof fetch = fetch): Promise<string | null> {
  const response = await fetcher(LATEST_RELEASE_URL, {
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("tag_name" in payload)) return null;
  return typeof payload.tag_name === "string" && payload.tag_name.trim()
    ? payload.tag_name
    : null;
}
