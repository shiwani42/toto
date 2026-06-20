import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family — Toto" },
      { name: "description", content: "Your family shopping space." },
    ],
  }),
  component: FamilyPage,
});

type Mode = "store" | "home";

function FamilyPage() {
  const [mode, setMode] = useState<Mode>("store");
  const [partnerJoined, setPartnerJoined] = useState(false);

  return (
    <div style={{ backgroundColor: "#FFFFFF", minHeight: "100%" }} className="px-5 pt-6 pb-6">
      {/* Header */}
      <h1 className="text-[20px] font-bold" style={{ color: "#1A1A1A" }}>
        Shop Together
      </h1>
      <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
        Coordinate with family — in store or at home
      </p>

      {/* Mode selector */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <ModeCard
          active={mode === "store"}
          onClick={() => setMode("store")}
          icon="🏪"
          title="In store"
          subtitle="Family split across aisles"
        />
        <ModeCard
          active={mode === "home"}
          onClick={() => setMode("home")}
          icon="🏠"
          title="At home"
          subtitle="They see what you scan"
        />
      </div>

      {mode === "store" ? (
        <StoreMode />
      ) : (
        <HomeMode
          partnerJoined={partnerJoined}
          onJoin={() => setPartnerJoined(true)}
        />
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-center"
      style={{
        backgroundColor: "#FFFFFF",
        border: active ? "2px solid #2D7D4E" : "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "16px 12px",
      }}
    >
      <div className="text-[24px] leading-none">{icon}</div>
      <p className="mt-2 text-[14px] font-bold" style={{ color: "#1A1A1A" }}>
        {title}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: "#6B7280" }}>
        {subtitle}
      </p>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase"
      style={{ color: "#9CA3AF", letterSpacing: "0.08em" }}
    >
      {children}
    </p>
  );
}

function StoreMode() {
  return (
    <div className="mt-5 space-y-5">
      {/* Session card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #2D7D4E",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <SectionLabel>Session Code</SectionLabel>
        <p
          className="mt-2 text-center text-[36px] font-bold tracking-wider"
          style={{ color: "#1A1A1A" }}
        >
          TRL-492
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="rounded-full py-2 text-[12px] font-medium"
            style={{ backgroundColor: "#E8F5EE", color: "#2D7D4E" }}
          >
            Copy
          </button>
          <button
            className="rounded-full py-2 text-[12px] font-medium"
            style={{ backgroundColor: "#E8F5EE", color: "#2D7D4E" }}
          >
            Share
          </button>
        </div>
      </div>

      {/* Family members */}
      <div>
        <SectionLabel>Who's here</SectionLabel>
        <div className="mt-2 space-y-2">
          <MemberRow status="online" name="You (Alex)" detail="Aisle A — Jackets" />
          <MemberRow status="online" name="Mum" detail="Aisle B — Footwear" />
          <MemberRow status="pending" name="Dad" detail="Joining..." />
          <button
            className="w-full rounded-xl py-3 text-[12px] font-medium"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px dashed #2D7D4E",
              color: "#2D7D4E",
            }}
          >
            + Invite
          </button>
        </div>
      </div>

      {/* Mini map */}
      <div>
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "16px",
            padding: "12px",
            height: "150px",
          }}
          className="flex flex-col"
        >
          <p className="text-[12px] font-semibold" style={{ color: "#2D7D4E" }}>
            📍 Live locations
          </p>
          <div className="mt-2 grid flex-1 grid-cols-4 gap-1.5">
            <Zone id="A" label="Jackets" highlight dotLabel="You" />
            <Zone id="B" label="Footwear" highlight dotLabel="Mum" />
            <Zone id="C" label="Tents" />
            <Zone id="D" label="Sleep" />
            <Zone id="E" label="Packs" />
            <Zone id="F" label="Layers" />
            <Zone id="G" label="Access." />
            <Zone id="✓" label="Checkout" />
          </div>
        </div>
      </div>

      {/* Shared cart */}
      <div>
        <SectionLabel>Shared Cart</SectionLabel>
        <div className="mt-2 space-y-2">
          <CartItem
            emoji="🧥"
            title="Rain jacket"
            who="Alex"
            price="CHF 149"
            votes="Mum ✓ · Dad ❓"
          />
          <CartItem
            emoji="👟"
            title="Boots"
            who="Mum"
            price="CHF 89"
            votes="Alex ✓ · Dad ✓"
          />
        </div>
        <button
          className="mt-3 w-full rounded-xl py-3 text-[13px] font-medium"
          style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
        >
          Open full cart →
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  status,
  name,
  detail,
}: {
  status: "online" | "pending";
  name: string;
  detail: string;
}) {
  const dot = status === "online" ? "#22C55E" : "#F59E0B";
  return (
    <div
      className="flex items-center gap-3"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "10px 14px",
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: "#1A1A1A" }}>
          {name}
        </p>
        <p className="text-[11px]" style={{ color: "#6B7280" }}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function Zone({
  id,
  label,
  highlight,
  dotLabel,
}: {
  id: string;
  label: string;
  highlight?: boolean;
  dotLabel?: string;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-md"
      style={{
        backgroundColor: highlight ? "#E8F5EE" : "#F5F7F2",
        border: highlight ? "1px solid #2D7D4E" : "1px solid transparent",
      }}
    >
      <span
        className="text-[10px] font-bold"
        style={{ color: highlight ? "#2D7D4E" : "#6B7280" }}
      >
        {id}
      </span>
      <span className="text-[8px]" style={{ color: "#6B7280" }}>
        {label}
      </span>
      {dotLabel && (
        <span
          className="mt-0.5 rounded-full px-1.5 text-[8px] font-semibold text-white"
          style={{ backgroundColor: "#2D7D4E" }}
        >
          {dotLabel}
        </span>
      )}
    </div>
  );
}

function CartItem({
  emoji,
  title,
  who,
  price,
  votes,
}: {
  emoji: string;
  title: string;
  who: string;
  price: string;
  votes: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "10px 14px",
      }}
    >
      <p className="text-[13px]" style={{ color: "#1A1A1A" }}>
        <span className="mr-1">{emoji}</span>
        <span className="font-semibold">{title}</span>
        <span style={{ color: "#6B7280" }}> · {who} · {price}</span>
      </p>
      <p className="mt-1 text-[11px]" style={{ color: "#6B7280" }}>
        Family: {votes}
      </p>
    </div>
  );
}

function HomeMode({
  partnerJoined,
  onJoin,
}: {
  partnerJoined: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="mt-5 space-y-5">
      {/* Invite card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #2D7D4E",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <p className="text-[13px]" style={{ color: "#1A1A1A" }}>
          Share this link with your partner:
        </p>
        <p
          className="mt-3 text-center text-[14px] font-semibold"
          style={{
            color: "#2D7D4E",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          toto.app/join/TRL-492
        </p>
        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded-full py-2.5 text-[13px] font-medium"
            style={{ backgroundColor: "#25D366", color: "#FFFFFF" }}
          >
            📱 Share via WhatsApp
          </button>
          <button
            className="w-full rounded-full py-2.5 text-[13px] font-medium"
            style={{ backgroundColor: "#E8F5EE", color: "#2D7D4E" }}
          >
            💬 Share via iMessage
          </button>
          <button
            className="w-full rounded-full py-2.5 text-[13px] font-medium"
            style={{
              backgroundColor: "#FFFFFF",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
            }}
          >
            🔗 Copy link
          </button>
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "12px 14px",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!partnerJoined && (
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "#F59E0B", opacity: 0.5 }}
              />
            )}
            <span
              className="relative h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: partnerJoined ? "#22C55E" : "#F59E0B" }}
            />
          </span>
          <p className="text-[13px]" style={{ color: "#1A1A1A" }}>
            {partnerJoined
              ? "Partner connected ✓"
              : "Waiting for partner..."}
          </p>
        </div>
        {!partnerJoined ? (
          <button
            onClick={onJoin}
            className="mt-3 w-full rounded-full py-2 text-[11px]"
            style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
          >
            Simulate partner joining
          </button>
        ) : (
          <button
            className="mt-3 w-full rounded-full py-2.5 text-[13px] font-medium"
            style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
          >
            Start scanning →
          </button>
        )}
      </div>

      {/* What partner sees */}
      <div>
        <SectionLabel>What your partner sees</SectionLabel>
        <div className="mt-2 space-y-2">
          <PartnerRow icon="👁️" text="Products you point at" />
          <PartnerRow icon="❤️" text="Their votes appear on your screen" />
          <PartnerRow icon="💬" text="In-product chat" />
        </div>
      </div>
    </div>
  );
}

function PartnerRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "10px 14px",
      }}
    >
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: "#2D7D4E" }}
      />
      <span className="text-[14px]">{icon}</span>
      <span className="text-[13px]" style={{ color: "#1A1A1A" }}>
        {text}
      </span>
    </div>
  );
}