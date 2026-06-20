import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/checklist")({
  component: Page,
});

function Page() {
  const [tripSet, setTripSet] = useState(false);
  return (
    <div
      style={{ backgroundColor: "#FFFFFF", minHeight: "100%" }}
      className="px-5 pt-6 pb-6"
    >
      <h1 className="text-[20px] font-bold" style={{ color: "#1A1A1A" }}>
        My List
      </h1>

      {tripSet ? <FilledList onReset={() => setTripSet(false)} /> : <EmptyState onDemo={() => setTripSet(true)} />}
    </div>
  );
}

function EmptyState({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="text-[40px] leading-none">📋</div>
      <p className="mt-3 text-[16px] font-bold" style={{ color: "#1A1A1A" }}>
        Your gear list is empty
      </p>
      <p className="mt-2 max-w-[280px] text-[13px]" style={{ color: "#6B7280" }}>
        Plan your trip on the Home screen and I'll generate your personal gear
        checklist
      </p>
      <button
        className="mt-5 rounded-full px-5 py-2 text-[13px] font-medium"
        style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
      >
        Plan my trip →
      </button>
      <button
        onClick={onDemo}
        className="mt-3 rounded-full px-3 py-1 text-[11px]"
        style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
      >
        Demo: show gear list
      </button>
    </div>
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

function FilledList({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-4 space-y-5">
      {/* Stat pills */}
      <div className="flex gap-2">
        <StatPill bg="#E8F5EE" color="#2D7D4E" text="✅ 2 got" />
        <StatPill bg="#FEF2F2" color="#DC2626" text="❌ 3 needed" />
        <StatPill bg="#FFFBEB" color="#D97706" text="⚠️ 1 risk" />
      </div>

      {/* Readiness */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold" style={{ color: "#1A1A1A" }}>
            Trip Readiness
          </span>
          <span className="text-[13px] font-bold" style={{ color: "#2D7D4E" }}>
            40%
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "#E5E7EB" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: "40%", backgroundColor: "#2D7D4E" }}
          />
        </div>
      </div>

      {/* Essential gear */}
      <div>
        <SectionLabel>Essential Gear</SectionLabel>
        <div className="mt-2 space-y-2">
          <GearItem
            state="done"
            title="Hiking Boots"
            subtitle="Salomon X Ultra · Size 42 · CHF 89"
          />
          <GearItem
            state="done"
            title="Water Bottle"
            subtitle="Nalgene 1L · CHF 15"
          />

          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1" style={{ backgroundColor: "#E5E7EB" }} />
            <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
              Still needed
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: "#E5E7EB" }} />
          </div>

          <GearItem
            state="missing"
            title="Rain Jacket"
            subtitle="Essential for 40% rain forecast"
          />
          <GearItem
            state="missing"
            title="Warm Layer"
            subtitle="11°C morning temperature"
          />
          <GearItem
            state="missing"
            title="First Aid Kit"
            subtitle="Essential for any hike"
          />
        </div>
      </div>

      {/* Optional */}
      <div>
        <SectionLabel>Optional</SectionLabel>
        <div className="mt-2 space-y-2">
          <GearItem
            state="optional"
            title="Trekking Poles"
            subtitle="Helpful on descents"
          />
        </div>
      </div>

      {/* Weather alert */}
      <div
        style={{
          backgroundColor: "#FFFBEB",
          borderLeft: "3px solid #D97706",
          borderRadius: "12px",
          padding: "12px 16px",
        }}
      >
        <p className="text-[12px]" style={{ color: "#92400E" }}>
          ⚠️ Rain forecast on June 21 — waterproof jacket is critical. Don't skip
          this one.
        </p>
      </div>

      <button
        onClick={onReset}
        className="mt-2 w-full rounded-full py-2 text-[11px]"
        style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
      >
        Demo: reset
      </button>
    </div>
  );
}

function StatPill({ bg, color, text }: { bg: string; color: string; text: string }) {
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {text}
    </span>
  );
}

function GearItem({
  state,
  title,
  subtitle,
}: {
  state: "done" | "missing" | "optional";
  title: string;
  subtitle: string;
}) {
  const isDone = state === "done";
  const isMissing = state === "missing";
  const isOptional = state === "optional";

  return (
    <div
      className="flex items-center gap-3"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderLeft: isMissing ? "3px solid #DC2626" : "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{
          backgroundColor: isDone
            ? "#2D7D4E"
            : isMissing
              ? "#FEF2F2"
              : "#F3F4F6",
          color: isDone ? "#FFFFFF" : isMissing ? "#DC2626" : "#9CA3AF",
          border: isMissing ? "1px solid #DC2626" : "none",
        }}
      >
        {isDone ? "✓" : isMissing ? "✕" : "○"}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[14px] font-bold"
          style={{ color: isOptional ? "#6B7280" : "#1A1A1A" }}
        >
          {title}
        </p>
        <p className="text-[12px]" style={{ color: isOptional ? "#9CA3AF" : "#6B7280" }}>
          {subtitle}
        </p>
      </div>
      {isDone && (
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ backgroundColor: "#E8F5EE", color: "#2D7D4E" }}
        >
          In list ✓
        </span>
      )}
      {isMissing && (
        <button
          className="rounded-full px-3 py-1 text-[11px] font-medium"
          style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
        >
          Find →
        </button>
      )}
      {isOptional && (
        <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
          Add?
        </span>
      )}
    </div>
  );
}
