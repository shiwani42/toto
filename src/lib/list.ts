import { broadcastSessionEvent } from "./session";
import { track } from "./analytics";
import { totoReact } from "./companion";
import { playAdded } from "./sounds";

const KEY = "toto.list";

export type StoredList = string[]; // product_code values, in insertion order

function read(): StoredList {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function write(list: StoredList) {
  sessionStorage.setItem(KEY, JSON.stringify(list));
}

export function getList(): StoredList {
  return read();
}

export function addToList(code: string, source: string = "manual"): StoredList {
  const list = read();
  if (!list.includes(code)) {
    list.push(code);
    broadcast("list:added", code);
    track("list_added", { code, source });
    totoReact("wag"); // a real pet wags when you bring something home
    playAdded();
  }
  write(list);
  return list;
}

export function removeFromList(code: string): StoredList {
  const before = read();
  const list = before.filter((c) => c !== code);
  if (list.length !== before.length) {
    broadcast("list:removed", code);
    track("list_removed", { code });
  }
  write(list);
  return list;
}

export function clearList(): void {
  sessionStorage.removeItem(KEY);
}

// Best-effort broadcast to the realtime session (if active). We don't await —
// list mutations stay snappy even if the network channel is slow.
function broadcast(
  kind: "list:added" | "list:removed",
  code: string,
): void {
  broadcastSessionEvent({ kind, code });
}
