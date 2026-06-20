import { loadSession, Session } from "./session";

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

export function addToList(code: string): StoredList {
  const list = read();
  if (!list.includes(code)) {
    list.push(code);
    broadcast("list:added", code);
  }
  write(list);
  return list;
}

export function removeFromList(code: string): StoredList {
  const before = read();
  const list = before.filter((c) => c !== code);
  if (list.length !== before.length) {
    broadcast("list:removed", code);
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
  const state = loadSession();
  if (!state) return;
  // Create a short-lived session just to send; connection is reused via a
  // singleton inside the channel layer if Supabase already opened it.
  try {
    const s = new Session(
      state.code,
      {
        id: state.me.id,
        name: state.me.name,
        emoji: state.me.emoji,
      },
      {},
    );
    s.connect()
      .then(() => s.send({ kind, from: state.me.id, code }))
      .then(() => s.disconnect())
      .catch(() => {
        /* swallow — broadcast is best-effort */
      });
  } catch {
    /* ignore */
  }
}
