import { createFileRoute } from "@tanstack/react-router";
import { Mic } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Toto — AI shopping concierge" },
      { name: "description", content: "Plan your Swiss outdoor trip with Toto, your AI gear concierge." },
      { property: "og:title", content: "Toto" },
      { property: "og:description", content: "Plan your Swiss outdoor trip with Toto." },
    ],
  }),
  component: Index,
});

const QUICK_STARTS = [
  { label: "I need a jacket", emoji: "🧥" },
  { label: "Full kit for a hike", emoji: "🎒" },
  { label: "Not sure, help me", emoji: "🤷" },
];

function Index() {
  const [tripSet, setTripSet] = useState(false);
  return (
    <div>
      <div
        className="text-center text-[12px]"
        style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF", padding: "8px" }}
      >
        📍 You're in Transa Zurich · Aisle map active
      </div>
      <div className="px-5 pt-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Trail<span className="text-primary">Mate</span>
        </h1>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Scandit
        </span>
      </header>

      {/* Plan your trip card */}
      <section className="mt-7">
        <div
          className="w-full rounded-2xl text-left"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid #2D7D4E",
            padding: "24px",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p
                className="text-[20px] font-bold leading-tight"
                style={{ color: "#1A1A1A" }}
              >
                Hi! Where are you headed?
              </p>
              <p className="mt-2 text-[14px]" style={{ color: "#6B7280" }}>
                Tell me your trip — I'll handle the rest
              </p>
            </div>
            <div className="relative shrink-0">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "#2D7D4E", opacity: 0.3 }}
              />
              <span
                className="relative flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
              >
                <Mic className="h-6 w-6" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick start chips */}
      <section className="mt-5 flex flex-wrap gap-2">
        {QUICK_STARTS.map((q) => (
          <button
            key={q.label}
            className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            {q.label} <span className="ml-1">{q.emoji}</span>
          </button>
        ))}
      </section>

      {/* Trip planner card */}
      <section className="mt-5">
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "16px",
            padding: "16px 20px",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ color: "#9CA3AF", letterSpacing: "0.08em" }}
            >
              Your Trip
            </span>
            <button
              onClick={() => setTripSet((v) => !v)}
              className="text-[11px] font-medium"
              style={{ color: "#2D7D4E" }}
            >
              Edit ✏️
            </button>
          </div>

          {!tripSet ? (
            <div className="mt-3 flex flex-col items-center text-center">
              <div className="text-[28px] leading-none">🗺️</div>
              <p className="mt-2 text-[14px]" style={{ color: "#1A1A1A" }}>
                No trip planned yet
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "#6B7280" }}>
                Tell me where you're going and I'll build your gear list
              </p>
              <button
                onClick={() => setTripSet(true)}
                className="mt-3 rounded-full px-4 py-1.5 text-[12px] font-medium"
                style={{ backgroundColor: "#2D7D4E", color: "#FFFFFF" }}
              >
                Plan my trip →
              </button>
              <button
                onClick={() => setTripSet(true)}
                className="mt-2 rounded-full px-3 py-1 text-[11px]"
                style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
              >
                Demo: fill trip
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <p className="text-[15px] font-bold" style={{ color: "#1A1A1A" }}>
                📍 Harder Kulm, Interlaken
              </p>
              <p className="text-[12px]" style={{ color: "#6B7280" }}>
                📅 June 21 · 1 day · First timer
              </p>
              <p className="text-[12px]" style={{ color: "#6B7280" }}>
                💰 Budget: CHF 150
              </p>
              <p className="text-[12px]" style={{ color: "#D97706" }}>
                🌧️ 40% rain forecast
              </p>
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
                Trip readiness
              </span>
              <span className="text-[11px] font-medium" style={{ color: "#2D7D4E" }}>
                40% · 3 items missing
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "#E5E7EB" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: "40%", backgroundColor: "#2D7D4E" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <FeatureCard
          icon="📷"
          title="Scan & identify"
          subtitle="Point at any product to understand it"
        />
        <FeatureCard
          icon="🗺️"
          title="Find it in store"
          subtitle="AR guides you to the exact shelf"
        />
      </section>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="rounded-xl"
      style={{ backgroundColor: "#FFFFFF", padding: "14px", border: "1px solid #E5E7EB" }}
    >
      <div className="text-xl leading-none" style={{ color: "#2D7D4E" }}>{icon}</div>
      <p
        className="mt-2 text-[13px] font-bold"
        style={{ color: "#1A1A1A" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-snug" style={{ color: "#6B7280" }}>
        {subtitle}
      </p>
    </div>
  );
}
