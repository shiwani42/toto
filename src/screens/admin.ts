// Retailer admin dashboard. Reads from the SQL views in
// supabase/migrations/0002_events_admin.sql. Single shop for now —
// every query implicitly covers shop_id='default'.

import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { authConfigured, getCurrentUser, signInWithEmail } from "../lib/auth";
import { isAdmin } from "../lib/admin";
import { getProduct } from "../lib/catalog";
import productsRaw from "../../data/products.json";

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
    <main class="screen-admin" id="admin-root">
      <div class="admin-skeleton">
        <div class="admin-skeleton__hero"></div>
        <div class="admin-skeleton__row">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="admin-skeleton__block"></div>
      </div>
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
//
// Three doors: unconfigured (no Supabase keys), not-an-admin (allow-list
// miss), and sign-in (the welcome). All three share a single calm card
// layout so the dashboard's "first impression" is always the same shape.

function unconfiguredHTML(): string {
  return `
    <div class="admin-gate">
      <div class="admin-gate__art" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      </div>
      <h2 class="admin-gate__title">Setup needed</h2>
      <p class="admin-gate__sub">The dashboard reads anonymous usage from Supabase. Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then run the migrations in <code>supabase/migrations/</code>.</p>
      <a class="link-btn" href="?screen=home">Back to the app</a>
    </div>
  `;
}

function notAdminHTML(email: string): string {
  return `
    <div class="admin-gate">
      <div class="admin-gate__art" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h2 class="admin-gate__title">You're in, just not here</h2>
      <p class="admin-gate__sub">Signed in as <strong>${escapeHTML(email)}</strong>. Ask the shop owner to add you to <code>public.admins</code> to unlock this view.</p>
      <a class="link-btn" href="?screen=home">Back to the app</a>
    </div>
  `;
}

function mountSignIn(host: HTMLElement) {
  host.innerHTML = `
    <div class="admin-gate">
      <div class="admin-gate__art" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v10H3z"/><path d="m3 7 9 6 9-6"/></svg>
      </div>
      <h2 class="admin-gate__title">Shop dashboard</h2>
      <p class="admin-gate__sub">A one-time link by email. Admins only.</p>
      <form id="admin-sign-in" class="admin-gate__form" novalidate>
        <input id="admin-email" type="email" required autocomplete="email"
               inputmode="email" placeholder="you@example.com" class="admin-gate__input" />
        <button type="submit" class="primary admin-gate__submit">Send the link</button>
        <p id="admin-sign-in-status" class="admin-gate__status" role="status" aria-live="polite"></p>
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
      // Land them back on the admin dashboard after the link click.
      await signInWithEmail(email, "admin");
      status.textContent = "Check your inbox for the sign-in link.";
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Couldn't send the link. Try again.";
    }
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

type CatalogRow = {
  shop_id: string;
  product_code: string;
  product_id: string;
  name: string;
  brand: string;
  category: string;
  color: string;
  size: string;
  price_chf: number;
  stock_total: number;
  stock_front: number;
  zone: string;
  zone_name: string;
};

async function mountDashboard(host: HTMLElement): Promise<void> {
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
    catalog,
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
    fetchMany<CatalogRow>("v_my_products", { limit: 500 }),
  ]);

  // Headline: one big hero number (7-day sessions) with a small set of
  // companion metrics underneath. Reads like Apple Health's hero stat
  // rather than five identical-weight tiles competing for attention.
  const hero = headline?.sessions_7d ?? 0;
  // Sum the last 14 days of funnel to compute conversion through the
  // wizard — gives the dashboard a "how's the funnel doing?" answer
  // up front instead of forcing the viewer to read a table.
  const totalStarted = funnel.reduce((n, r) => n + r.wizard_started, 0);
  const totalAdded = funnel.reduce((n, r) => n + r.added_to_list, 0);
  const overallConvPct = totalStarted > 0 ? Math.round((totalAdded / totalStarted) * 100) : null;

  host.innerHTML = `
    <header class="admin-hero">
      <div class="admin-hero__eyebrow">Shop dashboard</div>
      <div class="admin-hero__metric">
        <div class="admin-hero__value">${hero.toLocaleString()}</div>
        <div class="admin-hero__label">sessions, last 7 days</div>
      </div>
    </header>

    <section class="admin-kpis">
      ${kpiCard("Today",        headline?.sessions_24h ?? 0, "sessions")}
      ${kpiCard("30 days",      headline?.sessions_30d ?? 0, "sessions")}
      ${kpiCard("Added to list", headline?.adds_7d ?? 0, "in 7d")}
      ${kpiCard("Scanned",      headline?.scans_7d ?? 0, "in 7d")}
    </section>

    <section class="admin-card">
      <div class="admin-card__head">
        <h2>Funnel, last 14 days</h2>
        ${overallConvPct == null
          ? ""
          : `<span class="admin-card__pill">${overallConvPct}% reached list</span>`}
      </div>
      ${funnelVisual(funnel)}
    </section>

    <div class="admin-grid">
      <section class="admin-card">
        <h2>Categories in demand</h2>
        ${barList(topCategories.map((r) => ({ label: r.category, value: r.appeared_in_plans })))}
      </section>

      <section class="admin-card admin-card--alert">
        <div class="admin-card__head">
          <h2>Demand gaps</h2>
          <span class="admin-card__pill admin-card__pill--alert">Stock signal</span>
        </div>
        ${demandGaps.length === 0
          ? `<p class="admin-empty">Nothing missed yet.</p>`
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
        <h2>Who's walking in</h2>
        ${profileMixHTML(profileMix)}
      </section>

      <section class="admin-card admin-card--wide">
        <h2>Product performance</h2>
        ${productPerfTable(productPerf.slice(0, 25))}
      </section>

      <section class="admin-card admin-card--wide">
        <h2>Usage by hour <span class="admin-card__meta">UTC, last 14 days</span></h2>
        ${hourlyHTML(hourly)}
      </section>

      <section class="admin-card admin-card--wide" id="shop-settings-card">
        <div class="admin-card__head">
          <h2>Shop settings</h2>
        </div>
        <div id="shop-settings-body"><p class="admin-empty">Loading…</p></div>
      </section>

      <section class="admin-card admin-card--wide">
        <div class="admin-card__head">
          <h2>Catalog <span class="admin-card__meta">${catalog.length} ${catalog.length === 1 ? "product" : "products"}</span></h2>
          <span class="admin-card__pill">Manage</span>
        </div>
        ${catalogHTML(catalog)}
        <div class="admin-card__foot">
          <button type="button" id="catalog-import" class="link-btn">Import from CSV</button>
          <button type="button" id="catalog-seed" class="link-btn">Seed with demo catalog</button>
        </div>
      </section>
    </div>

    <a class="link-btn admin-back" href="?screen=home">Back to the app</a>
  `;

  wireCatalogActions(host, catalog);
  void mountShopSettings(host, catalog[0]?.shop_id ?? null);
}

/** Render the per-shop settings card (name + zone map upload). The
 *  shop row is fetched via fetchMyShops so we don't have to thread it
 *  through the dashboard fetch fan-out. */
async function mountShopSettings(host: HTMLElement, shopId: string | null) {
  const body = host.querySelector("#shop-settings-body") as HTMLDivElement | null;
  if (!body) return;
  if (!shopId) {
    body.innerHTML = `<p class="admin-empty">Sign in with a shop owner account, or seed a catalog first.</p>`;
    return;
  }
  const { data, error } = await getSupabase()
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .maybeSingle<{ id: string; name: string; slug: string; zone_map_url: string | null }>();
  if (error || !data) {
    body.innerHTML = `<p class="admin-empty">Couldn't load shop details.</p>`;
    return;
  }
  body.innerHTML = `
    <div class="shop-settings">
      <div class="shop-settings__row">
        <span class="shop-settings__label">Name</span>
        <span class="shop-settings__value">${escapeHTML(data.name)}</span>
      </div>
      <div class="shop-settings__row">
        <span class="shop-settings__label">Handle</span>
        <span class="shop-settings__value"><code>${escapeHTML(data.slug)}</code></span>
      </div>
      <div class="shop-settings__row shop-settings__row--map">
        <span class="shop-settings__label">Zone map</span>
        <div class="shop-settings__map">
          ${data.zone_map_url
            ? `<img src="${escapeHTML(data.zone_map_url)}" alt="Current zone map" class="shop-settings__map-preview" />`
            : `<div class="shop-settings__map-empty">No map uploaded yet.</div>`}
          <div class="shop-settings__map-actions">
            <label class="link-btn">
              <input type="file" id="zone-map-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden />
              ${data.zone_map_url ? "Replace zone map" : "Upload a zone map"}
            </label>
            <p class="shop-settings__map-status" id="zone-map-status" aria-live="polite"></p>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = body.querySelector("#zone-map-input") as HTMLInputElement;
  const status = body.querySelector("#zone-map-status") as HTMLParagraphElement;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = "Uploading…";
    try {
      const path = `${data.id}/zone-map-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`;
      const { error: upErr } = await getSupabase()
        .storage.from("shop-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = getSupabase().storage.from("shop-assets").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await getSupabase()
        .from("shops")
        .update({ zone_map_url: url, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (updErr) throw new Error(updErr.message);
      status.textContent = "Saved. Reloading…";
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      status.textContent = err instanceof Error ? `Couldn't upload: ${err.message}` : "Upload failed.";
    }
  });
}

function wireCatalogActions(host: HTMLElement, catalog: CatalogRow[]) {
  const seedBtn = host.querySelector("#catalog-seed") as HTMLButtonElement | null;
  const importBtn = host.querySelector("#catalog-import") as HTMLButtonElement | null;
  const shopId = catalog[0]?.shop_id ?? null;

  // Open the editor when an admin taps any product row in the table.
  host.querySelectorAll<HTMLTableRowElement>("tr[data-edit-code]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const code = tr.dataset.editCode!;
      const row = catalog.find((r) => r.product_code === code);
      if (!row) return;
      mountCatalogEditor(row, () => window.location.reload());
    });
  });

  seedBtn?.addEventListener("click", async () => {
    if (!shopId) {
      alert("No shop in context. Sign in with a shop owner account first.");
      return;
    }
    if (catalog.length > 0 && !confirm(`This will upsert the demo catalog (~${(productsRaw as unknown[]).length} rows) into the current shop. Existing rows with matching codes will be updated. Continue?`)) {
      return;
    }
    seedBtn.disabled = true;
    seedBtn.textContent = "Seeding…";
    try {
      const { inserted } = await seedCatalog(shopId);
      seedBtn.textContent = `Seeded ${inserted} rows. Reloading…`;
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      seedBtn.textContent = err instanceof Error ? `Failed: ${err.message}` : "Failed.";
      seedBtn.disabled = false;
    }
  });

  importBtn?.addEventListener("click", () => {
    if (!shopId) {
      alert("No shop in context. Sign in with a shop owner account first.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      importBtn.disabled = true;
      importBtn.textContent = "Reading file…";
      try {
        const text = await file.text();
        const rows = parseCatalogCsv(text, shopId);
        if (rows.length === 0) throw new Error("No data rows found in the CSV.");
        importBtn.textContent = `Uploading ${rows.length} rows…`;
        const { error } = await getSupabase()
          .from("products")
          .upsert(rows, { onConflict: "shop_id,product_code" });
        if (error) throw new Error(error.message);
        importBtn.textContent = `Uploaded ${rows.length}. Reloading…`;
        window.setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        importBtn.textContent = err instanceof Error ? `Failed: ${err.message}` : "Failed.";
        importBtn.disabled = false;
      }
    });
    input.click();
  });
}

// ─── Catalog rendering ──────────────────────────────────────────────────────

function catalogHTML(rows: CatalogRow[]): string {
  if (rows.length === 0) {
    return `<p class="admin-empty">No products yet. Seed the demo catalog or import a CSV to get started.</p>`;
  }
  // Cap rendered rows so a 2k-product catalog doesn't lock up the
  // page. The full count is shown in the heading.
  const shown = rows.slice(0, 50);
  return `
    <div class="admin-table-wrap">
      <table class="admin-table admin-table--clickable">
        <thead>
          <tr>
            <th>Code</th>
            <th>Product</th>
            <th>Category</th>
            <th>Size</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Zone</th>
          </tr>
        </thead>
        <tbody>
          ${shown.map((r) => `
            <tr data-edit-code="${escapeHTML(r.product_code)}">
              <td><code class="admin-table__code">${escapeHTML(r.product_code)}</code></td>
              <td>${escapeHTML(r.brand)} ${escapeHTML(r.name)}</td>
              <td>${escapeHTML(r.category)}</td>
              <td>${escapeHTML(r.size)}</td>
              <td>CHF ${Number(r.price_chf).toFixed(0)}</td>
              <td>${r.stock_front}/${r.stock_total}</td>
              <td>${escapeHTML(r.zone)} · ${escapeHTML(r.zone_name)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ${rows.length > shown.length ? `<p class="admin-table__more">+ ${rows.length - shown.length} more not shown</p>` : ""}
  `;
}

/** Slide-up sheet to edit one catalog row. Lets the admin tweak the
 *  fields they're most likely to change day-to-day — price, stock,
 *  zone, aisle. Heavier edits (name, category) are deferred to the
 *  CSV-import flow for now. */
function mountCatalogEditor(row: CatalogRow, onSaved: () => void) {
  const host = document.createElement("div");
  host.className = "party-sheet-host";
  host.innerHTML = `
    <div class="party-sheet-backdrop"></div>
    <form class="party-sheet" id="cat-sheet" novalidate>
      <h2 class="party-sheet__title">${escapeHTML(row.brand)} ${escapeHTML(row.name)}</h2>
      <p class="shop-onb__hint" style="margin-top:-12px;margin-bottom:16px">
        <code>${escapeHTML(row.product_code)}</code> · ${escapeHTML(row.category)} · size ${escapeHTML(row.size)}
      </p>

      <div class="party-sheet__field">
        <span class="party-sheet__label">Price (CHF)</span>
        <input id="cat-price" type="number" min="0" step="0.5" value="${Number(row.price_chf).toFixed(2)}" />
      </div>

      <div class="shop-onb__row">
        <div class="party-sheet__field">
          <span class="party-sheet__label">Stock on shelf</span>
          <input id="cat-stock-front" type="number" min="0" step="1" value="${row.stock_front}" />
        </div>
        <div class="party-sheet__field">
          <span class="party-sheet__label">Stock total</span>
          <input id="cat-stock-total" type="number" min="0" step="1" value="${row.stock_total}" />
        </div>
      </div>

      <div class="shop-onb__row">
        <div class="party-sheet__field">
          <span class="party-sheet__label">Zone</span>
          <input id="cat-zone" type="text" value="${escapeHTML(row.zone)}" placeholder="A" />
        </div>
        <div class="party-sheet__field">
          <span class="party-sheet__label">Aisle</span>
          <input id="cat-aisle" type="text" value="" placeholder="A1" />
        </div>
      </div>

      <div class="party-sheet__field">
        <span class="party-sheet__label">Zone name</span>
        <input id="cat-zone-name" type="text" value="${escapeHTML(row.zone_name)}" placeholder="Jackets & Shells" />
      </div>

      <p id="cat-sheet-status" class="shop-onb__status" role="status" aria-live="polite"></p>

      <div class="party-sheet__actions">
        <button type="button" id="cat-cancel" class="link-btn">Cancel</button>
        <button type="submit" class="primary party-sheet__save">Save</button>
      </div>
    </form>
  `;
  document.body.appendChild(host);
  requestAnimationFrame(() => host.classList.add("party-sheet-host--open"));

  function close() {
    host.classList.remove("party-sheet-host--open");
    window.setTimeout(() => host.remove(), 250);
  }
  (host.querySelector(".party-sheet-backdrop") as HTMLDivElement).addEventListener("click", close);
  (host.querySelector("#cat-cancel") as HTMLButtonElement).addEventListener("click", close);

  (host.querySelector("#cat-sheet") as HTMLFormElement).addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = host.querySelector("#cat-sheet-status") as HTMLParagraphElement;
    const price = Number((host.querySelector("#cat-price") as HTMLInputElement).value);
    const stockFront = Number((host.querySelector("#cat-stock-front") as HTMLInputElement).value);
    const stockTotal = Number((host.querySelector("#cat-stock-total") as HTMLInputElement).value);
    const zone = (host.querySelector("#cat-zone") as HTMLInputElement).value.trim();
    const aisle = (host.querySelector("#cat-aisle") as HTMLInputElement).value.trim();
    const zoneName = (host.querySelector("#cat-zone-name") as HTMLInputElement).value.trim();

    if (!Number.isFinite(price) || price < 0)            { status.textContent = "Price must be a number."; return; }
    if (!Number.isFinite(stockFront) || stockFront < 0)  { status.textContent = "Stock on shelf must be 0 or more."; return; }
    if (!Number.isFinite(stockTotal) || stockTotal < 0)  { status.textContent = "Stock total must be 0 or more."; return; }
    if (stockFront > stockTotal)                         { status.textContent = "Stock on shelf can't exceed total."; return; }

    status.textContent = "Saving…";
    const { error } = await getSupabase()
      .from("products")
      .update({
        price_chf: price,
        stock_front: stockFront,
        stock_total: stockTotal,
        zone,
        aisle,
        zone_name: zoneName,
        updated_at: new Date().toISOString(),
      })
      .eq("shop_id", row.shop_id)
      .eq("product_code", row.product_code);
    if (error) {
      status.textContent = `Couldn't save: ${error.message}`;
      return;
    }
    status.textContent = "Saved.";
    window.setTimeout(() => { close(); onSaved(); }, 350);
  });
}

// ─── Catalog actions ────────────────────────────────────────────────────────

/** Pull the bundled demo catalog and insert it into the active shop.
 *  Idempotent on (shop_id, product_code) — re-running is a noop. */
async function seedCatalog(shopId: string): Promise<{ inserted: number; skipped: number }> {
  const rows = (productsRaw as Array<Record<string, unknown>>).map((p) => ({
    shop_id: shopId,
    product_code: p.product_code,
    product_id: p.product_id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    color: p.color,
    size: p.size,
    price_chf: p.price_chf,
    discount_pct: p.discount_pct,
    weight_g: p.weight_g,
    waterproof_rating_mm: p.waterproof_rating_mm,
    temp_rating_c: p.temp_rating_c,
    material: p.material,
    tags: p.tags,
    zone: p.zone,
    zone_name: p.zone_name,
    aisle: p.aisle,
    stock_total: p.stock_total,
    stock_front: p.stock_front,
    description: p.description,
  }));
  const { error, count } = await getSupabase()
    .from("products")
    .upsert(rows, { onConflict: "shop_id,product_code", count: "exact" });
  if (error) throw new Error(error.message);
  return { inserted: count ?? rows.length, skipped: 0 };
}

/** Parse a CSV blob into product rows. Header row required.
 *  Accepts the same columns as products.json; missing optional ones
 *  default to sensible zeros / empty strings. */
function parseCatalogCsv(text: string, shopId: string): Record<string, unknown>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj: Record<string, unknown> = { shop_id: shopId };
    header.forEach((h, idx) => {
      const raw = (cells[idx] ?? "").trim();
      if (h === "tags") obj[h] = raw ? raw.split(/[|;,]/).map((s) => s.trim()).filter(Boolean) : [];
      else if (/^(price_chf|discount_pct)$/.test(h)) obj[h] = Number(raw || "0");
      else if (/^(weight_g|waterproof_rating_mm|temp_rating_c|stock_total|stock_front)$/.test(h)) {
        obj[h] = raw === "" ? null : Number(raw);
      }
      else obj[h] = raw;
    });
    rows.push(obj);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ─── New rendering helpers ──────────────────────────────────────────────────

function kpiCard(label: string, value: number, unit: string): string {
  return `
    <div class="admin-kpi">
      <div class="admin-kpi__value">${value.toLocaleString()}</div>
      <div class="admin-kpi__label">
        <span class="admin-kpi__label-main">${escapeHTML(label)}</span>
        <span class="admin-kpi__label-sub">${escapeHTML(unit)}</span>
      </div>
    </div>
  `;
}

/** Visual funnel: each step is a horizontal bar whose width reflects
 *  its absolute count relative to the top of funnel. Conversion %
 *  shown next to each bar. Reads top-to-bottom like a real funnel. */
function funnelVisual(rows: FunnelRow[]): string {
  if (rows.length === 0) return `<p class="admin-empty">No sessions yet.</p>`;
  const totals = rows.reduce(
    (acc, r) => {
      acc.wizard_started   += r.wizard_started;
      acc.wizard_completed += r.wizard_completed;
      acc.plan_returned    += r.plan_returned;
      acc.added_to_list    += r.added_to_list;
      acc.scanned_item     += r.scanned_item;
      acc.completed_scan   += r.completed_scan;
      return acc;
    },
    { wizard_started: 0, wizard_completed: 0, plan_returned: 0, added_to_list: 0, scanned_item: 0, completed_scan: 0 },
  );
  const steps: { label: string; value: number }[] = [
    { label: "Started a plan",     value: totals.wizard_started },
    { label: "Finished the wizard", value: totals.wizard_completed },
    { label: "Got a list back",    value: totals.plan_returned },
    { label: "Added items",        value: totals.added_to_list },
    { label: "Scanned in store",   value: totals.scanned_item },
    { label: "Wrapped a trip",     value: totals.completed_scan },
  ];
  const top = Math.max(steps[0].value, 1);
  return `
    <ol class="admin-funnel">
      ${steps.map((s, i) => {
        const pct = Math.round((s.value / top) * 100);
        const drop = i > 0 && steps[i - 1].value > 0
          ? Math.round((s.value / steps[i - 1].value) * 100)
          : null;
        return `
          <li class="admin-funnel__row">
            <div class="admin-funnel__bar">
              <div class="admin-funnel__fill" style="width:${pct}%"></div>
              <span class="admin-funnel__label">${escapeHTML(s.label)}</span>
              <span class="admin-funnel__value">${s.value.toLocaleString()}</span>
            </div>
            ${drop != null && i > 0
              ? `<div class="admin-funnel__drop">${drop}%</div>`
              : `<div class="admin-funnel__drop admin-funnel__drop--start">start</div>`}
          </li>
        `;
      }).join("")}
    </ol>
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
  // SVG bars with rounded tops, label only every 3rd hour for breathing
  // room, and a baseline rule. Each bar carries its raw count as a
  // tooltip so curious admins can hover.
  const w = 600;
  const barW = w / 24;
  const h = 140;
  const baseY = h - 24;
  const bars = Array.from(buckets.entries()).map(([hour, v]) => {
    const bh = max > 0 ? (v / max) * (baseY - 12) : 0;
    const showLabel = hour % 3 === 0;
    return `
      <g>
        <rect x="${hour * barW + 3}" y="${baseY - bh}" width="${barW - 6}" height="${Math.max(bh, 2)}"
              rx="3"
              fill="var(--accent)"
              opacity="${v === 0 ? 0.15 : 1}">
          <title>${v.toLocaleString()} session${v === 1 ? "" : "s"} at ${hour}:00</title>
        </rect>
        ${showLabel ? `<text x="${hour * barW + barW / 2}" y="${h - 6}" font-size="10" fill="var(--muted-fg)" text-anchor="middle">${hour}</text>` : ""}
      </g>
    `;
  }).join("");
  return `
    <svg viewBox="0 0 ${w} ${h}" class="admin-hourly" aria-label="Sessions per hour" preserveAspectRatio="none">
      <line x1="0" y1="${baseY}" x2="${w}" y2="${baseY}" stroke="var(--border)" stroke-width="1"/>
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
