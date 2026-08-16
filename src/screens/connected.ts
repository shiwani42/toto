import { getProduct } from "../lib/catalog";
import { getList } from "../lib/list";
import {
  clearSession,
  loadSession,
  globalSession,
  destroyGlobalSession,
  broadcastSessionEvent,
  type Member,
  type SessionEvent,
} from "../lib/session";
import { t } from "../lib/i18n";
import { illustrationForProduct } from "../lib/product-art";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function timeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type FeedEntry = { time: string; html: string };

export function renderConnected(root: HTMLElement) {
  const state = loadSession();
  if (!state) {
    location.replace("?screen=connect");
    return;
  }

  // Minimal layout: a tappable code as the only hero (tap to copy), a
  // quiet roster row, and a single combined stream for activity + chat.
  // Dropped the Your cart / Their cart duplicate sections (already in
  // the List tab), the standalone Copy / Open buttons, the verbose
  // "Connecting…" / "You're in. Share the code..." status banners.
  root.innerHTML = `
    <main class="screen-connected screen-connected--min">
      <button type="button" class="conn-code" id="code" aria-label="Tap to copy code">
        <span class="conn-code__value" id="code-val">${escapeHTML(state.code)}</span>
        <span class="conn-code__action" id="code-action" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </span>
      </button>

      <ul class="conn-roster" id="roster"></ul>

      <div class="conn-board" id="board"></div>

      <ul class="conn-stream" id="stream"></ul>

      <form class="conn-chat" id="chat-form">
        <input id="chat-input" type="text" placeholder="${escapeHTML(t("connected.say"))}" autocomplete="off" />
        <button class="conn-chat__send" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m22 2-7 20-4-9-9-4z"/>
            <path d="M22 2 11 13"/>
          </svg>
        </button>
      </form>

      <div class="conn-foot">
        <button class="conn-foot__btn" id="share" type="button">${t("connected.share")}</button>
        <button class="conn-foot__btn conn-foot__btn--leave" id="leave" type="button">${t("connected.leave")}</button>
      </div>
    </main>
  `;

  const rosterEl = root.querySelector("#roster") as HTMLUListElement;
  const streamEl = root.querySelector("#stream") as HTMLUListElement;
  const chatForm = root.querySelector("#chat-form") as HTMLFormElement;
  const chatInput = root.querySelector("#chat-input") as HTMLInputElement;
  const copyBtn = root.querySelector("#code") as HTMLButtonElement;
  const codeAction = root.querySelector("#code-action") as HTMLSpanElement;
  const shareBtn = root.querySelector("#share") as HTMLButtonElement;
  const leaveBtn = root.querySelector("#leave") as HTMLButtonElement;

  let members: Member[] = [
    {
      id: state.me.id,
      name: state.me.name,
      emoji: state.me.emoji,
    },
  ];
  // Single combined stream for activity and chat. Newest at the
  // bottom so the chat feel reads naturally and you can scroll back
  // through what people did/said.
  const stream: FeedEntry[] = [];

  function memberById(id: string): Member | undefined {
    return members.find((m) => m.id === id);
  }

  function nameFor(id: string): string {
    const m = memberById(id);
    if (m) return `${m.emoji} ${m.name}`;
    if (id === state!.me.id) return `${state!.me.emoji} ${state!.me.name}`;
    return "Someone";
  }

  function renderRoster() {
    if (members.length === 0) {
      rosterEl.innerHTML = `<li class="conn-roster__empty">${escapeHTML(t("connected.alone"))}</li>`;
      return;
    }
    rosterEl.innerHTML = members
      .map(
        (m) => `
          <li class="conn-roster__person ${m.id === state!.me.id ? "conn-roster__person--me" : ""}" title="${escapeHTML(m.name)}">
            <span class="conn-roster__avatar">${escapeHTML(m.emoji)}</span>
            <span class="conn-roster__name">${escapeHTML(m.name)}${m.id === state!.me.id ? " · you" : ""}</span>
          </li>
        `,
      )
      .join("");
  }

  function pushStream(html: string, kind: "event" | "chat" = "event") {
    stream.push({ time: timeStr(), html: `<span class="conn-stream__time">${timeStr()}</span> ${html}` });
    if (stream.length > 80) stream.shift();
    streamEl.innerHTML = stream
      .map((s) => `<li class="conn-stream__row conn-stream__row--${kind}">${s.html}</li>`)
      .join("");
    streamEl.scrollTop = streamEl.scrollHeight;
  }
  void pushStream; // suppress unused warning; used via two thin wrappers below
  function pushEvent(html: string) {
    stream.push({ time: timeStr(), html });
    if (stream.length > 80) stream.shift();
    streamEl.innerHTML = stream
      .map((s) => `<li class="conn-stream__row"><span class="conn-stream__time">${s.time}</span> ${s.html}</li>`)
      .join("");
    streamEl.scrollTop = streamEl.scrollHeight;
  }
  function pushChat(html: string) { pushEvent(html); }

  function describeEvent(e: SessionEvent): string {
    const who = nameFor(e.from);
    switch (e.kind) {
      case "list:snapshot":
        return `<strong>${escapeHTML(who)}</strong> shared a cart (${e.codes.length} items)`;
      case "list:request-snapshot":
        // silent. no feed noise, just triggers a reply
        return "";
      case "list:added": {
        const p = getProduct(e.code);
        return `<strong>${escapeHTML(who)}</strong> picked up <strong>${escapeHTML(p?.name ?? e.code)}</strong>`;
      }
      case "list:removed": {
        const p = getProduct(e.code);
        return `<strong>${escapeHTML(who)}</strong> put back <strong>${escapeHTML(p?.name ?? e.code)}</strong>`;
      }
      case "scan:found": {
        const p = getProduct(e.code);
        return `<strong>${escapeHTML(who)}</strong> found <strong>${escapeHTML(p?.name ?? e.code)}</strong>`;
      }
      case "vote": {
        const p = getProduct(e.code);
        const label =
          e.vote === "yes"
            ? t("connected.vote.said_yes")
            : e.vote === "maybe"
              ? t("connected.vote.said_maybe")
              : t("connected.vote.said_no");
        return `<strong>${escapeHTML(who)}</strong> ${escapeHTML(label)} <strong>${escapeHTML(p?.name ?? e.code)}</strong>`;
      }
      case "chat":
        return "";
    }
  }

  /** Inline yes / maybe / no card so a partner at home can react to
   *  something the in-store shopper just found or added. */
  function pushVoteCard(fromId: string, code: string) {
    const who = nameFor(fromId);
    const p = getProduct(code);
    const name = p?.name ?? code;
    const brand = p ? `${p.brand} · ${p.size}` : "";
    const art = p ? illustrationForProduct(p) : "";
    const id = `vote-${code.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;
    pushEvent(`
      <div class="conn-vote" data-vote-card="${escapeHTML(id)}" data-code="${escapeHTML(code)}">
        <div class="conn-vote__head">
          ${art ? `<span class="conn-vote__art" aria-hidden="true">${art}</span>` : ""}
          <div class="conn-vote__copy">
            <strong>${escapeHTML(who)}</strong> ${escapeHTML(t("connected.vote.prompt"))}
            <div class="conn-vote__name">${escapeHTML(name)}</div>
            ${brand ? `<div class="conn-vote__meta">${escapeHTML(brand)}</div>` : ""}
          </div>
        </div>
        <div class="conn-vote__actions">
          <button type="button" class="conn-vote__btn conn-vote__btn--yes" data-vote="yes">${escapeHTML(t("connected.vote.yes"))}</button>
          <button type="button" class="conn-vote__btn" data-vote="maybe">${escapeHTML(t("connected.vote.maybe"))}</button>
          <button type="button" class="conn-vote__btn conn-vote__btn--no" data-vote="no">${escapeHTML(t("connected.vote.no"))}</button>
        </div>
      </div>
    `);
  }

  streamEl.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-vote]");
    if (!btn) return;
    const card = btn.closest<HTMLElement>("[data-vote-card]");
    if (!card) return;
    const code = card.dataset.code;
    const vote = btn.dataset.vote as "yes" | "maybe" | "no" | undefined;
    if (!code || !vote) return;
    broadcastSessionEvent({ kind: "vote", code, vote });
    const label =
      vote === "yes"
        ? t("connected.vote.said_yes")
        : vote === "maybe"
          ? t("connected.vote.said_maybe")
          : t("connected.vote.said_no");
    const p = getProduct(code);
    card.innerHTML = `<span class="conn-vote__done">${escapeHTML(t("connected.vote.you"))} ${escapeHTML(label)} <strong>${escapeHTML(p?.name ?? code)}</strong></span>`;
  });

  const session = globalSession;
  if (!session) {
    location.replace("?screen=connect");
    return;
  }

  session.listener = {
    onPresence: (m) => {
      members = m.length
        ? m
        : [
            {
              id: state.me.id,
              name: state.me.name,
              emoji: state.me.emoji,
            },
          ];
      renderRoster();
    },
    onEvent: (e) => {
      if (e.kind === "chat") {
        const who = nameFor(e.from);
        pushChat(`<strong>${escapeHTML(who)}</strong> ${escapeHTML(e.text)}`);
        return;
      }

      // Someone joined and is asking for our current cart — reply with a snapshot.
      if (e.kind === "list:request-snapshot") {
        const list = getList();
        if (list.length > 0) {
          session
            .send({ kind: "list:snapshot", from: state!.me.id, codes: list })
            .catch(console.error);
        }
        return; // no feed noise
      }

      // Partner reacts to someone else's find / pick — show vote buttons.
      if (
        (e.kind === "scan:found" || e.kind === "list:added") &&
        e.from !== state!.me.id
      ) {
        const desc = describeEvent(e);
        if (desc) pushEvent(desc);
        pushVoteCard(e.from, e.code);
        return;
      }

      const desc = describeEvent(e);
      if (desc) pushEvent(desc);
    },
  };

  function seedOpenSession() {
    if (!state) return;
    const list = getList();
    const who = `${state.me.emoji} ${state.me.name}`;
    pushEvent(
      `<div class="conn-hint">Share <strong>${escapeHTML(state.code)}</strong>. They see this list the moment they join.</div>`,
    );
    if (list.length > 0) {
      pushEvent(
        `<strong>${escapeHTML(who)}</strong> brought ${list.length} item${list.length > 1 ? "s" : ""}`,
      );
      for (const code of list.slice(0, 5)) {
        const p = getProduct(code);
        const name = p?.name ?? code;
        const brand = p ? `${p.brand} · ${p.size}` : "";
        const art = p ? illustrationForProduct(p) : "";
        pushEvent(`
          <div class="conn-pick">
            ${art ? `<span class="conn-pick__art" aria-hidden="true">${art}</span>` : ""}
            <div>
              <div class="conn-pick__name">${escapeHTML(name)}</div>
              ${brand ? `<div class="conn-pick__meta">${escapeHTML(brand)}</div>` : ""}
            </div>
            <span class="conn-pick__tag">on the list</span>
          </div>
        `);
      }
    } else {
      pushEvent(
        `<strong>${escapeHTML(who)}</strong> is waiting. Add a jacket, then they can vote.`,
      );
    }
  }
  seedOpenSession();

  // Quietly broadcast our presence + cart snapshot when the page mounts.
  setTimeout(async () => {
    const list = getList();
    await Promise.all([
      session.send({ kind: "list:request-snapshot", from: state.me.id }),
      list.length > 0
        ? session.send({ kind: "list:snapshot", from: state.me.id, codes: list })
        : Promise.resolve(),
    ]);
  }, 100);

  // Tappable code: copy to clipboard on click and morph the icon into a
  // check briefly so the user sees the action was acknowledged.
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.code);
    } catch {
      // Clipboard might be blocked in some contexts. Selecting the
      // text is a graceful fallback.
      const range = document.createRange();
      const valEl = root.querySelector("#code-val");
      if (valEl) {
        range.selectNodeContents(valEl);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
    copyBtn.classList.add("conn-code--copied");
    codeAction.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    `;
    window.setTimeout(() => {
      copyBtn.classList.remove("conn-code--copied");
      codeAction.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      `;
    }, 1400);
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    pushChat(
      `<strong>${escapeHTML(`${state.me.emoji} ${state.me.name}`)} (you)</strong> ${escapeHTML(text)}`,
    );
    chatInput.value = "";
    await session.send({ kind: "chat", from: state.me.id, text });
  });

  shareBtn.addEventListener("click", async () => {
    const url = `${location.origin}/?screen=connect&code=${state.code}`;
    const original = shareBtn.textContent ?? "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Come shop with me",
          text: `Open Toto with code ${state.code}.`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = "Link copied";
        setTimeout(() => (shareBtn.textContent = original), 1500);
      }
    } catch (err) {
      console.warn(err);
    }
  });

  leaveBtn.addEventListener("click", async () => {
    if (!confirm("Leave this session? You can rejoin with the same code.")) return;
    // Disconnect globally
    destroyGlobalSession();
    clearSession();
    location.replace("?screen=connect");
  });

  // NOTE: we intentionally do NOT call session.disconnect() on beforeunload.
  // Every screen transition is a full page reload, so beforeunload fires on
  // navigate-to-list, navigate-to-scan, etc. — not just on true tab closes.
  // Calling disconnect() there causes other members to see a leave/rejoin
  // cycle every time you pop over to check your list. Instead, we let the
  // browser close the WebSocket naturally; Supabase detects the drop via its
  // heartbeat (a few seconds) and cleans up presence automatically.
  // Explicit disconnect() is only called from the "Leave session" button above.

  renderRoster();
}
