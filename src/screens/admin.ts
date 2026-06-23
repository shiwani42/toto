// Retailer admin dashboard. Reads from the SQL views in
// supabase/migrations/0002_events_admin.sql. Single shop for now —
// every query implicitly covers shop_id='default'.

import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { authConfigured, getCurrentUser, signInWithEmail } from "../lib/auth";
import { isAdmin } from "../lib/admin";
import { getProduct } from "../lib/catalog";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ─── State ──────────────────────────────────────────────────────────────────

type Headline = {
  sessions_24h: number;
  sessions_7d: number;
  sessions_30d: number;
  adds_7d: number;
  scans_7d: number;
};
type FunnelRow = {
  day: string;
  wizard_started: number;
  wizard_completed: number;
  plan_returned: number;
  added_to_list: number;
  scanned_item: number;
  completed_scan: number;
};
type Bucket = { label: string; value: number };
type ProductPerfRow = {
  code: string;
  views: number;
  picks: number;
  adds: number;
  scans: number;
  pick_rate_pct: number | null;
};

// ─── Render ─────────────────────────────────────────────────────────────────

export function renderAdmin(root: HTMLElement) {
  root.innerHTML = `
    <header>
      <h1>Shop dashboard</h1>
      <p class="tag">What shoppers are asking the assistant, where they drop off, and which products land.</p>
    </header>
    <main class="screen-admin" id="admin-root">
      <div class="admin-loading">Loading…</div>
    </main>
  `;

  const main = root.querySelector("#admin-root") as HTMLElement;

  void (async () => {
    if (!authConfigured || !supabaseConfigured) {
      main.innerHTML = unconfiguredHTML();
      return;
    }
    const user = await getCurrentUser();
    if (!user) {
      mountSignIn(main);
      return;
    }
    const admin = await isAdmin();
    if (!admin) {
      main.innerHTML = notAdminHTML(user.email ?? "");
      return;
    }
    await mountDashboard(main);
  })();
}

// ─── Gating screens ─────────────────────────────────────────────────────────

function unconfiguredHTML(): string {
  return `
    <div class="admin-gate">
      <h2>Setup needed</h2>
      <p>The dashboard needs Supabase to read anonymous usage events.
         Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
         and re-deploy, then run the migrations in <code>supabase/migrations/</code>.</p>
      <a class="link-btn" href="?screen=home">Back</a>
    </div>
  `;
}

function notAdminHTML(email: string): string {
  return `
    <div class="admin-gate">
      <h2>Not authorized</h2>
      <p>Signed in as <strong>${escapeHTML(email)}</strong>, but this account is not on the
         admin allow-list for this shop. Ask the shop owner to add your email by
         inserting a row into <code>public.admins</code>.</p>
      <a class="link-btn" href="?screen=home">Back</a>
    </div>
  `;
}

function mountSignIn(host: HTMLElement) {
  host.innerHTML = `
    <div class="admin-gate">
      <h2>Sign in to view the dashboard</h2>
      <p>Admins only. You'll get a one-time sign-in link by email.</p>
      <form id="admin-sign-in" class="account-form" novalidate>
        <label class="account-form__label">
          Email
          <input id="admin-email" type="email" required autocomplete="email"
                 inputmode="email" placeholder="you@example.com" />
        </label>
        <button type="submit" class="btn-primary account-form__submit">Send sign-in link</button>
        <p id="admin-sign-in-status" class="account-form__status" role="status" aria-live="polite"></p>
      </form>
    </div>
  `;
  const form = host.querySelector("#admin-sign-in") as HTMLFormElement;
  const input = host.querySelector("#admin-email") as HTMLInputElement;
  const status = host.querySelector("#admin-sign-in-status") as HTMLElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email) { status.textContent = "Type your email first."; return; }
    status.textContent = "Sending…";
    try {
      await signInWithEmail(email);
      status.textContent = "Check your email for the sign-in link.";
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Couldn't send the link. Try again.";
    }
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

async function mountDashboard(host: HTMLElement): Promise<void> {
  host.innerHTML = `<div class="admin-loading">Crunching the numbers…</div>`;

  const [
    headline,
    funnel,
    topCategories,
    purposeMix,
    activityMix,
    profileMix,
    productPerf,
    demandGaps,
    hourly,
  ] = await Promise.all([
    fetchOne<Headline>("v_headline_counters"),
    fetchMany<FunnelRow>("v_funnel_daily", { limit: 14, order: "day", asc: false }),
    fetchMany<{ category: string; appeared_in_plans: number }>("v_top_categories", { limit: 10 }),
    fetchMany<{ purpose: string | null; sessions: number }>("v_purpose_mix"),
    fetchMany<{ activity: string | null; sessions: number }>("v_activity_mix", { limit: 8 }),
    fetchMany<{ gender: string | null; age: string | null; experience: string | null; sessions: number }>("v_profile_mix", { limit: 100 }),
    fetchMany<ProductPerfRow>("v_product_performance", { limit: 200 }),
    fetchMany<{ category: string; sessions: number }>("v_demand_gaps", { limit: 10 }),
    fetchMany<{ hour_utc: number; sessions: number }>("v_hourly_usage"),
  ]);

  host.innerHTML = `
    <section class="admin-headline">
      ${headlineCard("Last 24h sessions",   headline?.sessions_24h ?? 0)}
      ${headlineCard("Last 7d sessions",    headline?.sessions_7d  ?? 0)}
      ${headlineCard("Last 30d sessions",   headline?.sessions_30d ?? 0)}
      ${headlineCard("Items added (7d)",    headline?.adds_7d      ?? 0)}
      ${headlineCard("Scans (7d)",          headline?.scans_7d     ?? 0)}
    </section>

    <section class="admin-card">
      <h2>14-day conversion funnel</h2>
      <p class="tag">Daily counts. How many sessions reached each step.</p>
      ${funnelTable(funnel.slice().reverse())}
    </section>

    <div class="admin-grid">
      <section class="admin-card">
        <h2>Top categories asked for</h2>
        <p class="tag">Which categories the assistant returned most.</p>
        ${barList(topCategories.map((r) => ({ label: r.category, value: r.appeared_in_plans })))}
      </section>

      <section class="admin-card admin-card--alert">
        <h2>Demand gaps</h2>
        <p class="tag">Shoppers asked for these, but the plan came back empty. Stock signal.</p>
        ${demandGaps.length === 0
          ? `<p class="admin-empty">No gaps detected. Keep this view in mind as data grows.</p>`
          : barList(demandGaps.map((r) => ({ label: r.category, value: r.sessions })), "alert")}
      </section>

      <section class="admin-card">
        <h2>Trip purpose</h2>
        ${barList(purposeMix.map((r) => ({ label: prettyPurpose(r.purpose), value: r.sessions })))}
      </section>

      <section class="admin-card">
        <h2>Activity mix</h2>
        ${barList(activityMix.map((r) => ({ label: prettyActivity(r.activity), value: r.sessions })))}
      </section>

      <section class="admin-card admin-card--wide">
        <h2>Customer profile mix</h2>
        <p class="tag">Aggregated who's walking in (anonymous). Helps decide assortment.</p>
        ${profileMixHTML(profileMix)}
      </section>

      <section class="admin-card admin-card--wide">
        <h2>Product performance</h2>
        <p class="tag">Views from the swipe deck, picks (right-swipes), adds to list, in-store scans, and pick rate.</p>
        ${productPerfTable(productPerf.slice(0, 25))}
      </section>

      <section class="admin-card admin-card--wide">
        <h2>Usage by hour (UTC, last 14 days)</h2>
        ${hourlyHTML(hourly)}
      </section>
    </div>

    <a class="link-btn" href="?screen=home">Back to the app</a>
  `;
}

// ─── Supabase helpers ───────────────────────────────────────────────────────

async function fetchOne<T>(view: string): Promise<T | null> {
  try {
    const { data, error } = await getSupabase()
      .from(view)
      .select("*")
      .limit(1)
      .maybeSingle<T>();
    if (error) {
      console.warn(`fetch ${view} failed:`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`fetch ${view} threw:`, err);
    return null;
  }
}

async function fetchMany<T>(
  view: string,
  opts: { limit?: number; order?: string; asc?: boolean } = {},
): Promise<T[]> {
  try {
    let q = getSupabase().from(view).select("*");
    if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q.returns<T[]>();
    if (error) {
      console.warn(`fetch ${view} failed:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`fetch ${view} threw:`, err);
    return [];
  }
}

// ─── Rendering helpers ──────────────────────────────────────────────────────

function headlineCard(label: string, value: number): string {
  return `
    <div class="admin-headline__card">
      <div class="admin-headline__value">${value.toLocaleString()}</div>
      <div class="admin-headline__label">${escapeHTML(label)}</div>
    </div>
  `;
}

function barList(items: Bucket[], variant: "default" | "alert" = "default"): string {
  if (items.length === 0) {
    return `<p class="admin-empty">No data yet.</p>`;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return `
    <ul class="admin-bars">
      ${items.map((i) => `
        <li class="admin-bars__row">
          <span class="admin-bars__label">${escapeHTML(i.label)}</span>
          <span class="admin-bars__track">
            <span class="admin-bars__fill ${variant === "alert" ? "admin-bars__fill--alert" : ""}"
                  style="width:${Math.round((i.value / max) * 100)}%"></span>
          </span>
          <span class="admin-bars__value">${i.value.toLocaleString()}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function funnelTable(rows: FunnelRow[]): string {
  if (rows.length === 0) return `<p class="admin-empty">No sessions yet.</p>`;
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Wizard started</th>
            <th>Wizard completed</th>
            <th>Plan returned</th>
            <th>Added to list</th>
            <th>Scanned item</th>
            <th>Finished scan</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const conv = r.wizard_started > 0
              ? Math.round(100 * (r.added_to_list / r.wizard_started))
              : 0;
            return `
              <tr>
                <td>${escapeHTML(r.day)}</td>
                <td>${r.wizard_started}</td>
                <td>${r.wizard_completed}</td>
                <td>${r.plan_returned}</td>
                <td>${r.added_to_list} <span class="admin-table__sub">(${conv}%)</span></td>
                <td>${r.scanned_item}</td>
                <td>${r.completed_scan}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

type ProfileRow = {
  gender: string | null;
  age: string | null;
  experience: string | null;
  sessions: number;
};

function profileMixHTML(rows: ProfileRow[]): string {
  if (rows.length === 0) return `<p class="admin-empty">No completed wizards yet.</p>`;

  // Roll up each dimension on its own.
  const sumBy = (key: keyof ProfileRow) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = (r[key] as string | null) ?? "unknown";
      m.set(v, (m.get(v) ?? 0) + r.sessions);
    }
    return Array.from(m.entries())
      .map(([k, v]) => ({ label: prettyValue(key, k), value: v }))
      .sort((a, b) => b.value - a.value);
  };

  return `
    <div class="admin-mix">
      <div>
        <h3>Gender</h3>
        ${barList(sumBy("gender"))}
      </div>
      <div>
        <h3>Age</h3>
        ${barList(sumBy("age"))}
      </div>
      <div>
        <h3>Experience</h3>
        ${barList(sumBy("experience"))}
      </div>
    </div>
  `;
}

function productPerfTable(rows: ProductPerfRow[]): string {
  if (rows.length === 0) return `<p class="admin-empty">No product interactions yet.</p>`;
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Views</th>
            <th>Picks</th>
            <th>Adds</th>
            <th>Scans</th>
            <th>Pick rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const p = getProduct(r.code);
            const name = p ? `${p.brand} ${p.name}` : r.code;
            const cat = p?.category ?? "—";
            const rate = r.pick_rate_pct == null ? "—" : `${r.pick_rate_pct}%`;
            return `
              <tr>
                <td>${escapeHTML(name)}</td>
                <td>${escapeHTML(cat)}</td>
                <td>${r.views}</td>
                <td>${r.picks}</td>
                <td>${r.adds}</td>
                <td>${r.scans}</td>
                <td><strong>${rate}</strong></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function hourlyHTML(rows: Array<{ hour_utc: number; sessions: number }>): string {
  const buckets = new Map<number, number>();
  for (let h = 0; h < 24; h++) buckets.set(h, 0);
  for (const r of rows) buckets.set(r.hour_utc, r.sessions);
  const max = Math.max(...Array.from(buckets.values()), 1);
  const w = 600;
  const barW = w / 24;
  const h = 120;
  const bars = Array.from(buckets.entries()).map(([hour, v]) => {
    const bh = max > 0 ? (v / max) * (h - 24) : 0;
    return `
      <g>
        <rect x="${hour * barW + 2}" y="${h - 20 - bh}" width="${barW - 4}" height="${bh}"
              fill="var(--accent)" rx="2"></rect>
        <text x="${hour * barW + barW / 2}" y="${h - 6}" font-size="10" fill="var(--muted-fg)"
              text-anchor="middle">${hour}</text>
      </g>
    `;
  }).join("");
  return `
    <svg viewBox="0 0 ${w} ${h}" class="admin-hourly" aria-label="Sessions per hour">
      ${bars}
    </svg>
  `;
}

function prettyValue(key: keyof ProfileRow, raw: string): string {
  if (raw === "unknown") return "Not set";
  if (key === "gender") {
    return raw === "man" ? "Men" : raw === "woman" ? "Women" : "Unisex / other";
  }
  if (key === "age") {
    const map: Record<string, string> = {
      u20: "Under 20",
      "20-30": "20 to 30",
      "30-45": "30 to 45",
      "45-60": "45 to 60",
      "60+": "60 plus",
    };
    return map[raw] ?? raw;
  }
  if (key === "experience") {
    const map: Record<string, string> = {
      new: "New",
      comfortable: "Comfortable",
      enthusiast: "Enthusiast",
      pro: "Pro",
    };
    return map[raw] ?? raw;
  }
  return raw;
}

function prettyPurpose(raw: string | null): string {
  if (!raw) return "Not set";
  return raw === "trip" ? "Planning a trip"
       : raw === "general" ? "Everyday gear"
       : raw === "browse"  ? "Just looking"
       : raw;
}

function prettyActivity(raw: string | null): string {
  if (!raw) return "Not set";
  const map: Record<string, string> = {
    "day-hike":   "Day hike",
    "multi-day":  "Multi-day trek",
    "camping":    "Camping",
    "climbing":   "Climbing",
    "trail-run":  "Trail run",
    "skiing":     "Ski / snowboard",
    "other":      "Other",
  };
  return map[raw] ?? raw;
}
