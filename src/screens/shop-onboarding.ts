// Shop-owner onboarding. Two paths:
//   * Signed out → send a magic link, on return land back here.
//   * Signed in  → render a single calm form (name, slug, city) and
//     create the shops + shop_admins rows on submit. After save we
//     redirect to /?screen=admin which will now scope to this shop.

import { authConfigured, getCurrentUser, signInWithEmail, onAuthChange } from "../lib/auth";
import { createShop, slugify } from "../lib/shops";
import { icon } from "../lib/icons";

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderShopOnboarding(root: HTMLElement) {
  root.innerHTML = `
    <main class="screen-admin" id="onboarding-root">
      <div class="admin-skeleton">
        <div class="admin-skeleton__hero"></div>
        <div class="admin-skeleton__block"></div>
      </div>
    </main>
  `;
  const host = root.querySelector("#onboarding-root") as HTMLElement;

  void (async () => {
    if (!authConfigured) {
      host.innerHTML = unconfiguredHTML();
      return;
    }
    const user = await getCurrentUser();
    if (!user) {
      mountSignIn(host);
      return;
    }
    mountForm(host, user.email ?? "");
  })();

  // Re-mount when auth state changes (the user clicks the email link
  // and lands back here authenticated).
  const unsub = onAuthChange((user) => {
    if (user) mountForm(host, user.email ?? "");
  });
  const observer = new MutationObserver(() => {
    if (!document.contains(host)) {
      unsub();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Gate: not configured ───────────────────────────────────────────────────

function unconfiguredHTML(): string {
  return `
    <div class="admin-gate">
      <div class="admin-gate__art" aria-hidden="true">${icon("settings", 32)}</div>
      <h2 class="admin-gate__title">Setup needed</h2>
      <p class="admin-gate__sub">Shop signup needs Supabase to be configured first. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then run the migrations in <code>supabase/migrations/</code>.</p>
      <a class="link-btn" href="?screen=home">Back to the app</a>
    </div>
  `;
}

// ─── Sign in (magic link) ───────────────────────────────────────────────────

function mountSignIn(host: HTMLElement) {
  host.innerHTML = `
    <div class="admin-gate">
      <div class="admin-gate__art" aria-hidden="true">${icon("store", 32)}</div>
      <h2 class="admin-gate__title">List your shop</h2>
      <p class="admin-gate__sub">One link by email and we'll set up your shop together.</p>
      <form id="shop-sign-in" class="admin-gate__form" novalidate>
        <input id="shop-email" type="email" required autocomplete="email"
               inputmode="email" placeholder="you@example.com" class="admin-gate__input" />
        <button type="submit" class="primary admin-gate__submit">Send the link</button>
        <p id="shop-sign-in-status" class="admin-gate__status" role="status" aria-live="polite"></p>
      </form>
    </div>
  `;
  const form = host.querySelector("#shop-sign-in") as HTMLFormElement;
  const input = host.querySelector("#shop-email") as HTMLInputElement;
  const status = host.querySelector("#shop-sign-in-status") as HTMLElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email) { status.textContent = "Type your email first."; return; }
    status.textContent = "Sending…";
    try {
      await signInWithEmail(email, "shop-onboarding");
      status.textContent = "Check your inbox for the sign-in link.";
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "Couldn't send the link. Try again.";
    }
  });
}

// ─── The form ───────────────────────────────────────────────────────────────

function mountForm(host: HTMLElement, ownerEmail: string) {
  host.innerHTML = `
    <header class="admin-hero">
      <div class="admin-hero__eyebrow">List your shop</div>
      <div class="admin-hero__metric">
        <div class="admin-hero__value" style="font-size:32px;letter-spacing:-0.02em">Tell us about it</div>
        <div class="admin-hero__label">${escapeHTML(ownerEmail)}</div>
      </div>
    </header>

    <form id="shop-form" class="admin-card" novalidate>
      <div class="shop-onb__field">
        <label class="shop-onb__label" for="shop-name">Shop name</label>
        <input id="shop-name" type="text" required placeholder="Alpine Outfitters" />
      </div>

      <div class="shop-onb__field">
        <label class="shop-onb__label" for="shop-slug">URL handle</label>
        <input id="shop-slug" type="text" required placeholder="alpine-outfitters" pattern="[a-z0-9-]+" />
        <p class="shop-onb__hint">Lowercase letters, numbers, dashes. Shoppers reach you via <code>?shop=&lt;handle&gt;</code>.</p>
      </div>

      <div class="shop-onb__row">
        <div class="shop-onb__field">
          <label class="shop-onb__label" for="shop-city">City</label>
          <input id="shop-city" type="text" placeholder="Verbier" />
        </div>
        <div class="shop-onb__field">
          <label class="shop-onb__label" for="shop-country">Country</label>
          <input id="shop-country" type="text" placeholder="Switzerland" value="Switzerland" />
        </div>
      </div>

      <div class="shop-onb__field">
        <label class="shop-onb__label" for="shop-address">Address <small class="muted">(optional)</small></label>
        <input id="shop-address" type="text" placeholder="Rue de la Poste 12" />
      </div>

      <p id="shop-form-status" class="shop-onb__status" role="status" aria-live="polite"></p>

      <button type="submit" id="shop-submit" class="primary">Create my shop</button>
    </form>

    <a class="link-btn admin-back" href="?screen=home">Back to the app</a>
  `;

  const form = host.querySelector("#shop-form") as HTMLFormElement;
  const nameEl = host.querySelector("#shop-name") as HTMLInputElement;
  const slugEl = host.querySelector("#shop-slug") as HTMLInputElement;
  const cityEl = host.querySelector("#shop-city") as HTMLInputElement;
  const countryEl = host.querySelector("#shop-country") as HTMLInputElement;
  const addressEl = host.querySelector("#shop-address") as HTMLInputElement;
  const statusEl = host.querySelector("#shop-form-status") as HTMLParagraphElement;
  const submitBtn = host.querySelector("#shop-submit") as HTMLButtonElement;

  // Auto-generate the slug as the user types the name, until they
  // edit the slug themselves.
  let slugTouched = false;
  slugEl.addEventListener("input", () => { slugTouched = true; });
  nameEl.addEventListener("input", () => {
    if (!slugTouched) slugEl.value = slugify(nameEl.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim();
    const slug = (slugEl.value.trim() || slugify(name)).toLowerCase();
    if (!name)                                 { statusEl.textContent = "Give your shop a name first."; return; }
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
      statusEl.textContent = "The handle should be lowercase letters, numbers, and dashes (3 to 40 characters).";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = "Creating…";
    try {
      const shop = await createShop({
        slug,
        name,
        ownerEmail,
        address: addressEl.value.trim() || undefined,
        city: cityEl.value.trim() || undefined,
        country: countryEl.value.trim() || undefined,
      });
      statusEl.textContent = "Done. Loading your dashboard…";
      // Land on the admin scoped to this shop.
      const url = new URL(window.location.href);
      url.searchParams.set("screen", "admin");
      url.searchParams.set("shop", shop.slug);
      window.location.href = url.toString();
    } catch (err) {
      statusEl.textContent = err instanceof Error
        ? err.message
        : "Couldn't create the shop. Try again.";
      submitBtn.disabled = false;
    }
  });
}
