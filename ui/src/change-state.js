export const CHANGE_SEEN_KEY = "blancherive.effectifs.vus.v1";
export const CHANGE_MAX_AGE = 14 * 86400000;

export function parseSeenChanges(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, date]) =>
      id && typeof date === "number" && date >= now - CHANGE_MAX_AGE && date <= now));
  } catch { return {}; }
}

export function markChangesSeen(previous, events, now = Date.now()) {
  const next = { ...previous };
  events.forEach(event => { next[event.id] = now; });
  return parseSeenChanges(JSON.stringify(next), now);
}

export function recentChanges(events, now = Date.now()) {
  return (events || []).filter(e => Date.parse(e.date) >= now - CHANGE_MAX_AGE);
}
