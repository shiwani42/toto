import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scan")({
  component: Page,
});

function Page() {
  return (
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-extrabold capitalize text-foreground">scan</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
