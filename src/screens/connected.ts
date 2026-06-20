import { getProduct } from "../lib/catalog";
import { getList, addToList } from "../lib/list";
import {
  clearSession,
  loadSession,
  globalSession,
  destroyGlobalSession,
  type Member,
  type SessionEvent,
} from "../lib/session";

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

// Render a mini cart card for a set of product codes
function renderCartHTML(
  codes: string[],
  who: string,
  emptyMsg: string,
): string {
  if (codes.length === 0) {
    return `<p class="hint">${escapeHTML(emptyMsg)}</p>`;
  }
  return `
    <p class="tag">${escapeHTML(who)}'s list, ${codes.length} item${codes.length > 1 ? "s" : ""}</p>
    <ul class="cart-list">
      ${codes
        .map((code) => {
          const p = getProduct(code);
          if (!p) return `<li class="cart-item"><span class="cart-item__name">${escapeHTML(code)}</span></li>`;
          return `
            <li class="cart-item">
              <span class="cart-item__name">${escapeHTML(p.name)}</span>
              <span class="cart-item__sub">${escapeHTML(p.brand)} · ${escapeHTML(p.size)} · ${escapeHTML(p.color)}</span>
            </li>`;
        })
        .join("")}
    </ul>`;
}

export function renderConnected(root: HTMLElement) {
  const state = loadSession();
  if (!state) {
    location.replace("?screen=connect");
    return;
  }

  const isPartner = state.mode === "partner";

  root.innerHTML = `
    <header>
      <h1>${isPartner ? "Live with your partner." : "Shopping together."}</h1>
    </header>
    <main class="screen-connected">
      <div class="session-code-hero">
        <p class="session-code-hero__label">Session code</p>
        <div class="session-code-hero__code" id="code">${escapeHTML(state.code)}</div>
      </div>

      <div class="status" id="status">Connecting…</div>

      <section class="card-section">
        <h2>Who's here</h2>
        <ul class="roster" id="roster"></ul>
      </section>

      <section class="card-section" id="their-cart-section" style="display:none">
        <h2>Their cart</h2>
        <div id="their-cart"><p class="hint">Waiting for their cart to sync…</p></div>
        <button class="link-btn" id="merge-btn" style="display:none;margin-top:8px">
          Add their picks to my list
        </button>
      </section>

      <section class="card-section">
        <h2>Your cart</h2>
        <div id="my-cart"></div>
      </section>

      <section class="card-section">
        <h2>What's happening</h2>
        <ul class="feed" id="feed"><li class="hint">Quiet so far.</li></ul>
      </section>

      <section class="card-section">
        <h2>Chat</h2>
        <ul class="chat" id="chat"></ul>
        <form class="chat-form" id="chat-form">
          <input id="chat-input" type="text" placeholder="Say something…" />
          <button class="primary" type="submit">Send</button>
        </form>
      </section>

      <div class="row-buttons">
        <a class="primary" href="?screen=list">Open my list</a>
        <button class="link-btn" id="copy">Copy code</button>
        <button class="link-btn" id="share">Share invite</button>
        <button class="link-btn" id="leave">Leave</button>
      </div>
    </main>
  `;

  const statusEl = root.querySelector("#status") as HTMLDivElement;
  const rosterEl = root.querySelector("#roster") as HTMLUListElement;
  const feedEl = root.querySelector("#feed") as HTMLUListElement;
  const chatEl = root.querySelector("#chat") as HTMLUListElement;
  const chatForm = root.querySelector("#chat-form") as HTMLFormElement;
  const chatInput = root.querySelector("#chat-input") as HTMLInputElement;
  const copyBtn = root.querySelector("#copy") as HTMLButtonElement;
  const shareBtn = root.querySelector("#share") as HTMLButtonElement;
  const leaveBtn = root.querySelector("#leave") as HTMLButtonElement;
  const theirCartSection = root.querySelector("#their-cart-section") as HTMLElement;
  const theirCartEl = root.querySelector("#their-cart") as HTMLDivElement;
  const myCartEl = root.querySelector("#my-cart") as HTMLDivElement;
  const mergeBtn = root.querySelector("#merge-btn") as HTMLButtonElement;

  let members: Member[] = [];
  const feed: FeedEntry[] = [];
  const chat: FeedEntry[] = [];

  // Track other members' carts: memberId → product codes[]
  const otherCarts = new Map<string, string[]>();

  function memberById(id: string): Member | undefined {
    return members.find((m) => m.id === id);
  }

  function nameFor(id: string): string {
    const m = memberById(id);
    if (m) return `${m.emoji} ${m.name}`;
    if (id === state!.me.id) return `${state!.me.emoji} ${state!.me.name}`;
    return "Someone";
  }

  function renderMyCart() {
    const list = getList();
    myCartEl.innerHTML = renderCartHTML(
      list,
      `${state!.me.emoji} ${state!.me.name}`,
      "Nothing in your cart yet.",
    );
  }

  function renderTheirCart() {
    if (otherCarts.size === 0) return;
    theirCartSection.style.display = "";
    // Merge all other members' carts into one view
    const allCodes = Array.from(otherCarts.entries()).flatMap(([id, codes]) => {
      const who = nameFor(id);
      return codes.map((c) => ({ who, code: c }));
    });
    const uniqueCodes = [...new Set(allCodes.map((x) => x.code))];
    // Show by first contributor's name
    const firstEntry = Array.from(otherCarts.entries())[0];
    const firstWho = firstEntry ? nameFor(firstEntry[0]) : "Partner";
    theirCartEl.innerHTML = renderCartHTML(uniqueCodes, firstWho, "");
    mergeBtn.style.display = uniqueCodes.length > 0 ? "" : "none";
  }

  function renderRoster() {
    if (members.length === 0) {
      rosterEl.innerHTML = `<li class="hint">Just you so far.</li>`;
      return;
    }
    rosterEl.innerHTML = members
      .map(
        (m) => `
          <li class="member-row ${m.id === state!.me.id ? "member-row--me" : ""}">
            <span class="member-row__dot member-row__dot--green" title="Online"></span>
            <span class="member-row__emoji">${escapeHTML(m.emoji)}</span>
            <div class="member-row__body">
              <div class="member-row__name">${escapeHTML(m.name)}${m.id === state!.me.id ? " <span style=\"font-size:11px;color:var(--muted-fg);font-weight:400\">(you)</span>" : ""}</div>
              <div class="member-row__detail">📍 ${escapeHTML(m.zone ?? "entry")}</div>
            </div>
          </li>
        `,
      )
      .join("");
  }

  function pushFeed(html: string) {
    feed.unshift({ time: timeStr(), html });
    if (feed.length > 30) feed.pop();
    feedEl.innerHTML = feed
      .map(
        (f) => `<li><span class="feed__time">${f.time}</span> ${f.html}</li>`,
      )
      .join("");
  }

  function pushChat(html: string) {
    chat.push({ time: timeStr(), html });
    if (chat.length > 60) chat.shift();
    chatEl.innerHTML = chat
      .map(
        (c) =>
          `<li><span class="chat__time">${c.time}</span> ${c.html}</li>`,
      )
      .join("");
    chatEl.scrollTop = chatEl.scrollHeight;
  }

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
        return `<strong>${escapeHTML(who)}</strong> ${e.vote === "yes" ? "likes" : "isn't sold on"} this one`;
      }
      case "chat":
        return "";
    }
  }

  const session = globalSession;
  if (!session) {
    location.replace("?screen=connect");
    return;
  }

  session.listener = {
    onPresence: (m) => {
      members = m;
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

      // Keep other members' carts up to date
      if (e.kind === "list:snapshot") {
        otherCarts.set(e.from, e.codes);
        renderTheirCart();
      } else if (e.kind === "list:added") {
        const existing = otherCarts.get(e.from) ?? [];
        if (!existing.includes(e.code)) existing.push(e.code);
        otherCarts.set(e.from, existing);
        renderTheirCart();
      } else if (e.kind === "list:removed") {
        const existing = otherCarts.get(e.from) ?? [];
        otherCarts.set(
          e.from,
          existing.filter((c) => c !== e.code),
        );
        renderTheirCart();
      }

      const desc = describeEvent(e);
      if (desc) pushFeed(desc);
    },
  };

  // Wait a small amount of time for the global session to connect if it was just initialized
  setTimeout(async () => {
    statusEl.textContent = "You're in. Share the code to bring others.";
    renderMyCart();

    const list = getList();

    // Push our own cart to the feed entry so we remember we joined.
    if (list.length > 0) {
      pushFeed(
        `<strong>${escapeHTML(`${state.me.emoji} ${state.me.name}`)}</strong> joined with ${list.length} item${list.length > 1 ? "s" : ""}`,
      );
    }

    // Tell everyone in the room "I just joined, please send me your cart".
    // Existing members will hear this and respond with list:snapshot.
    // We also broadcast our own snapshot at the same time so they see ours.
    await Promise.all([
      session.send({ kind: "list:request-snapshot", from: state.me.id }),
      list.length > 0
        ? session.send({ kind: "list:snapshot", from: state.me.id, codes: list })
        : Promise.resolve(),
    ]);
  }, 100);

  // Merge their cart into mine
  mergeBtn.addEventListener("click", () => {
    const allCodes = Array.from(otherCarts.values()).flat();
    let added = 0;
    for (const code of allCodes) {
      const before = getList();
      if (!before.includes(code)) {
        addToList(code);
        added++;
      }
    }
    mergeBtn.textContent = added === 0 ? "Already had them" : `Added ${added}`;
    renderMyCart();
    setTimeout(() => {
      mergeBtn.textContent = "Add their picks to my list";
    }, 2000);
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

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy code"), 1500);
    } catch {
      copyBtn.textContent = "Code: " + state.code;
    }
  });

  shareBtn.addEventListener("click", async () => {
    const url = `${location.origin}/?screen=connect&code=${state.code}`;
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
        setTimeout(() => (shareBtn.textContent = "Share invite"), 1500);
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
