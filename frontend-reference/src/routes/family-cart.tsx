import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mic, Send, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/family-cart")({
  head: () => ({
    meta: [
      { title: "Family Cart — Toto" },
      { name: "description", content: "Shop together with your family in store." },
    ],
  }),
  component: FamilyCart,
});

type Member = {
  key: string;
  name: string;
  initial: string;
  color: string;
  aisle: string;
  // position on mini-map (% of width/height)
  x: number;
  y: number;
};

const MEMBERS: Member[] = [
  { key: "you", name: "You", initial: "A", color: "#22C55E", aisle: "Aisle A · Jackets", x: 8, y: 30 },
  { key: "mum", name: "Mum", initial: "M", color: "#22C55E", aisle: "Aisle B · Footwear", x: 22, y: 30 },
  { key: "dad", name: "Dad", initial: "D", color: "#3B82F6", aisle: "Near checkout", x: 88, y: 80 },
  { key: "sister", name: "Sister", initial: "S", color: "#F59E0B", aisle: "Aisle E · Backpacks", x: 64, y: 30 },
];

const AISLES = [
  { id: "A", label: "Jackets" },
  { id: "B", label: "Footwear" },
  { id: "C", label: "Tents" },
  { id: "D", label: "Sleep" },
  { id: "E", label: "Backpacks" },
  { id: "F", label: "Base layers" },
  { id: "G", label: "Accessories" },
];

const TABS = ["All", "You", "Mum", "Dad", "Sister"] as const;
type Tab = (typeof TABS)[number];

function FamilyCart() {
  const [tab, setTab] = useState<Tab>("All");
  const [focused, setFocused] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [coordinateChat, setCoordinateChat] = useState(false);

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "#E5E7EB" }}
      >
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: "#1A1A1A" }}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-[16px] font-bold" style={{ color: "#1A1A1A" }}>
          Family Cart
        </h1>
        <span
          className="rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{ backgroundColor: "#E8F5EE", color: "#2D7D4E" }}
        >
          CHF 203 / 400
        </span>
      </header>

      <div className="px-4 pt-4">
        {/* Location strip */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 w-max">
            {MEMBERS.map((m) => (
              <button
                key={m.key}
                onClick={() => setFocused(m.key)}
                className="flex items-center gap-2 rounded-full px-3 py-2"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: `1px solid ${focused === m.key ? "#2D7D4E" : "#E5E7EB"}`,
                }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initial}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[11px] font-semibold" style={{ color: "#1A1A1A" }}>
                    {m.name}
                  </span>
                  <span className="block text-[11px]" style={{ color: "#6B7280" }}>
                    {m.aisle}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Smart notifications */}
        <div className="mt-4 space-y-2">
          {!dismissed.sleeping && (
            <AlertCard
              tone="amber"
              icon="⚠️"
              title="Dad and Sister are both near sleeping bags"
              subtitle="You only need one for the trip"
              primaryLabel="Coordinate →"
              onPrimary={() => setCoordinateChat(true)}
              onDismiss={() =>
                setDismissed((d) => ({ ...d, sleeping: true }))
              }
            >
              {coordinateChat && (
                <ChatThread
                  product={{ icon: "🛏️", title: "Sleeping bag", price: "—" }}
                  prefill="Hey, I see you're also looking at sleeping bags — let's not buy two!"
                  onClose={() => setCoordinateChat(false)}
                />
              )}
            </AlertCard>
          )}
          {!dismissed.firstaid && (
            <AlertCard
              tone="green"
              icon="💡"
              title="Mum already has a first aid kit"
              subtitle="Remove yours to save CHF 25"
              primaryLabel="Remove mine →"
              onPrimary={() =>
                setDismissed((d) => ({ ...d, firstaid: true }))
              }
              onDismiss={() =>
                setDismissed((d) => ({ ...d, firstaid: true }))
              }
            />
          )}
        </div>

        {/* Store mini-map */}
        <div
          className="relative mt-4 rounded-xl overflow-hidden"
          style={{ backgroundColor: "#F5F7F2", height: "140px" }}
        >
          {/* Aisle rectangles in 2 rows */}
          <div className="absolute inset-3 grid grid-rows-2 gap-2">
            <div className="grid grid-cols-4 gap-2">
              {AISLES.slice(0, 4).map((a) => (
                <AisleBox key={a.id} id={a.id} label={a.label} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {AISLES.slice(4).map((a) => (
                <AisleBox key={a.id} id={a.id} label={a.label} />
              ))}
            </div>
          </div>
          {/* Member dots */}
          {MEMBERS.map((m) => (
            <span
              key={m.key}
              className="absolute h-3 w-3 rounded-full ring-2 ring-white"
              style={{
                backgroundColor: m.color,
                left: `${m.x}%`,
                top: `${m.y}%`,
                transform: focused === m.key ? "scale(1.4)" : "scale(1)",
                transition: "transform 200ms",
              }}
            />
          ))}
        </div>

        {/* Compartment tabs */}
        <div
          className="mt-5 flex gap-5 border-b"
          style={{ borderColor: "#E5E7EB" }}
        >
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="pb-2 text-[13px] font-semibold"
                style={{
                  color: active ? "#2D7D4E" : "#9CA3AF",
                  borderBottom: active ? "2px solid #2D7D4E" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Compartments */}
        <div className="mt-5 space-y-6">
          {(tab === "All" || tab === "You") && (
            <Compartment label="You" header="Alex · CHF 149 · 1 item">
              <ItemCard
                accent="#2D7D4E"
                title="Arc'teryx Beta"
                price="CHF 149"
                badges={["✓ Trip match", "✓ In budget"]}
                votes="Mum ✓ · Dad ❓ · Sister ✓"
                action={{
                  label: "Ask family",
                  tone: "light",
                  onClick: () =>
                    setChatOpen(chatOpen === "arcteryx" ? null : "arcteryx"),
                }}
              />
              {chatOpen === "arcteryx" && (
                <ChatThread onClose={() => setChatOpen(null)} />
              )}
            </Compartment>
          )}

          {(tab === "All" || tab === "Mum") && (
            <Compartment label="Mum" header="Mum · CHF 89 · 1 item">
              <ItemCard
                accent="#2D7D4E"
                title="Salomon Boots"
                price="CHF 89"
                badges={["✓ Trip match", "✓ In budget"]}
                votes="You ✓ · Dad ✓"
              />
            </Compartment>
          )}

          {(tab === "All" || tab === "Dad") && (
            <Compartment label="Dad" header="Dad · CHF 120 · 1 item">
              <ItemCard
                accent="#D97706"
                title="Osprey Backpack"
                price="CHF 120"
                warn="⚠️ Puts family budget CHF 3 over"
                action={{ label: "See alternatives", tone: "amber" }}
              />
            </Compartment>
          )}

          {tab === "All" && (
            <Compartment label="Shared items" header="Split across family · 1 item">
              <ItemCard
                accent="#2D7D4E"
                title="First Aid Kit"
                price="CHF 25"
                note="Split 4 ways = CHF 6 each"
              />
            </Compartment>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-3"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div>
            <p className="text-[11px]" style={{ color: "#6B7280" }}>
              Total
            </p>
            <p className="text-[15px] font-bold" style={{ color: "#2D7D4E" }}>
              CHF 383 / 400
            </p>
          </div>
          <button
            className="flex-1 rounded-full px-4 py-3 text-[14px] font-semibold"
            style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
          >
            Checkout together →
          </button>
        </div>
      </div>
    </div>
  );
}

function AisleBox({ id, label }: { id: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB" }}
    >
      <span className="text-[10px] font-bold" style={{ color: "#2D7D4E" }}>
        {id}
      </span>
      <span className="text-[8px]" style={{ color: "#6B7280" }}>
        {label}
      </span>
    </div>
  );
}

function AlertCard({
  tone,
  icon,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  onDismiss,
  children,
}: {
  tone: "amber" | "green";
  icon: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimary: () => void;
  onDismiss: () => void;
  children?: React.ReactNode;
}) {
  const palette =
    tone === "amber"
      ? { bg: "#FFFBEB", border: "#D97706", primaryText: "#D97706" }
      : { bg: "#E8F5EE", border: "#2D7D4E", primaryText: "#2D7D4E" };
  return (
    <div
      className="rounded-xl animate-fade-in"
      style={{
        backgroundColor: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        padding: "12px 14px",
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-[16px] leading-none mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold" style={{ color: "#1A1A1A" }}>
            {title}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: "#6B7280" }}>
            {subtitle}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={onPrimary}
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "#FFFFFF", color: palette.primaryText, border: `1px solid ${palette.border}` }}
            >
              {primaryLabel}
            </button>
            <button
              onClick={onDismiss}
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ color: "#6B7280" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChatThread({
  onClose,
  product,
  prefill,
}: {
  onClose: () => void;
  product?: { icon: string; title: string; price: string };
  prefill?: string;
}) {
  const p = product ?? { icon: "🧥", title: "Arc'teryx Beta", price: "CHF 149" };
  const isCoordinate = !!prefill;
  return (
    <div
      className="mt-3 rounded-xl animate-fade-in overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB" }}
    >
      {/* Header with product mini-card */}
      <div
        className="flex items-center gap-3 px-3 py-2 border-b"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center text-[18px]"
          style={{ backgroundColor: "#F5F7F2" }}
        >
          {p.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold" style={{ color: "#1A1A1A" }}>
            {p.title}
          </p>
          <p className="text-[11px]" style={{ color: "#6B7280" }}>
            {p.price}
          </p>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-full"
          style={{ color: "#6B7280" }}
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="px-3 py-3 space-y-2">
        {isCoordinate ? (
          <Bubble side="right" name="You" bg="#2D7D4E" color="#FFFFFF">
            {prefill}
          </Bubble>
        ) : (
          <>
        <Bubble side="right" name="You" bg="#2D7D4E" color="#FFFFFF">
          Should I get this? It's CHF 149
        </Bubble>
        <Bubble side="left" name="Mum" bg="#F5F7F2" color="#1A1A1A">
          Looks good! Is it waterproof enough?
        </Bubble>
        <Bubble side="left" name="Toto AI" bg="#E8F5EE" color="#2D7D4E" ai>
          Yes — 20,000mm HH rating. More than enough for Interlaken's 40% rain forecast. Mum, it'll keep Alex dry all day.
        </Bubble>
        <Bubble side="left" name="Dad" bg="#F5F7F2" color="#1A1A1A">
          Bit expensive for one day hike no?
        </Bubble>
        <Bubble side="left" name="Toto AI" bg="#E8F5EE" color="#2D7D4E" ai>
          Fair point. The Mammut at CHF 79 covers the same trip. You'd save CHF 70 for the family budget.
        </Bubble>
          </>
        )}
      </div>

      {!isCoordinate && <>
      {/* Vote bar */}
      <div className="px-3 pb-2 flex gap-2">
        <VotePill label="✓ Buy it" count={2} />
        <VotePill label="✗ Skip it" count={1} />
        <VotePill label="❓ Unsure" count={1} />
      </div>

      {/* AI summary */}
      <div className="mx-3 mb-3 rounded-lg p-3" style={{ backgroundColor: "#E8F5EE" }}>
        <p className="text-[11px] font-semibold" style={{ color: "#2D7D4E" }}>
          AI summary
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "#1A1A1A" }}>
          Split decision. AI recommends:{" "}
          <span className="font-semibold">Mammut CHF 79</span> — same protection, better for family budget.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
          >
            Switch to Mammut
          </button>
          <button
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: "#FFFFFF", color: "#2D7D4E", border: "1px solid #2D7D4E" }}
          >
            Keep Arc'teryx
          </button>
        </div>
      </div>
      </>}

      {/* Input bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-t"
        style={{ borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}
      >
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 rounded-full px-3 py-2 text-[12px] outline-none"
          style={{ backgroundColor: "#F5F7F2", color: "#1A1A1A" }}
        />
        <button
          className="h-8 w-8 flex items-center justify-center rounded-full"
          style={{ color: "#2D7D4E" }}
          aria-label="Voice"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          className="h-8 w-8 flex items-center justify-center rounded-full"
          style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Bubble({
  side,
  name,
  bg,
  color,
  ai,
  children,
}: {
  side: "left" | "right";
  name: string;
  bg: string;
  color: string;
  ai?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <p
          className={`text-[10px] mb-0.5 ${side === "right" ? "text-right" : "text-left"}`}
          style={{ color: "#9CA3AF" }}
        >
          {name}
          {ai && (
            <span
              className="ml-1 inline-block rounded px-1 text-[9px] font-bold align-middle"
              style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
            >
              AI
            </span>
          )}
        </p>
        <div
          className="rounded-2xl px-3 py-2 text-[12px] leading-snug"
          style={{ backgroundColor: bg, color }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function VotePill({ label, count }: { label: string; count: number }) {
  return (
    <button
      className="flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold"
      style={{ backgroundColor: "#F5F7F2", color: "#1A1A1A", border: "1px solid #E5E7EB" }}
    >
      {label} · {count}
    </button>
  );
}

function Compartment({
  label,
  header,
  children,
}: {
  label: string;
  header: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "#2D7D4E" }}
        >
          ── {label} ──
        </span>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: "#6B7280" }}>
        {header}
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ItemCard({
  accent,
  title,
  price,
  badges,
  votes,
  warn,
  note,
  action,
}: {
  accent: string;
  title: string;
  price: string;
  badges?: string[];
  votes?: string;
  warn?: string;
  note?: string;
  action?: { label: string; tone: "light" | "amber"; onClick?: () => void };
}) {
  return (
    <div
      className="rounded-xl"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderLeft: `4px solid ${accent}`,
        padding: "12px 14px",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-bold" style={{ color: "#1A1A1A" }}>
          {title}
        </p>
        <p className="text-[14px] font-bold" style={{ color: "#1A1A1A" }}>
          {price}
        </p>
      </div>
      {badges && (
        <p className="mt-1 text-[11px]" style={{ color: "#2D7D4E" }}>
          {badges.join(" · ")}
        </p>
      )}
      {warn && (
        <p className="mt-1 text-[11px]" style={{ color: "#D97706" }}>
          {warn}
        </p>
      )}
      {note && (
        <p className="mt-1 text-[11px]" style={{ color: "#6B7280" }}>
          {note}
        </p>
      )}
      {votes && (
        <p className="mt-2 text-[11px]" style={{ color: "#6B7280" }}>
          Family votes: <span style={{ color: "#1A1A1A" }}>{votes}</span>
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={
            action.tone === "amber"
              ? { backgroundColor: "#FFFBEB", color: "#D97706" }
              : { backgroundColor: "#E8F5EE", color: "#2D7D4E" }
          }
        >
          {action.label}
        </button>
      )}
    </div>
  );
}