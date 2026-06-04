import { createFileRoute } from "@tanstack/react-router";
import Visualizer from "@/components/Visualizer";

export const Route = createFileRoute("/embed")({
  head: () => ({
    meta: [
      { title: "O(patience) — Embedded visualizer" },
      { name: "description", content: "A chrome-free sorting algorithm visualizer widget you can embed in blog posts and teaching pages via iframe. Supports Bubble, Selection, Insertion, Merge, and Quick Sort." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmbedPage,
});

function EmbedPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <h1 className="sr-only">O(patience) — Sorting Algorithm Visualizer Widget</h1>
      <div className="mx-auto max-w-5xl px-3 py-4">
        <Visualizer embed />
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Powered by{" "}
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="font-semibold text-foreground hover:underline"
          >
            O(patience)
          </a>
        </p>
      </div>
    </main>
  );
}
