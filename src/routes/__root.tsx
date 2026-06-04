import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import Footer from "@/components/Footer";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "O(patience) — Sorting Algorithm Visualizer" },
      { name: "description", content: "Visualize & quiz yourself on Bubble, Selection, Insertion, Merge, and Quick Sort. Step through algorithms frame-by-frame with live complexity stats and sound." },
      { name: "author", content: "Abhirai" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sortpatience.com/" },
      { property: "og:title", content: "O(patience) — Sorting Algorithm Visualizer" },
      { property: "og:description", content: "Visualize & quiz yourself on Bubble, Selection, Insertion, Merge, and Quick Sort. Step through algorithms frame-by-frame with live complexity stats and sound." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/pAFyLptvTqTlzw6tuE6HWBExBnr1/social-images/social-1780541109126-O(patience).webp" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:site_name", content: "O(patience)" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:url", content: "https://sortpatience.com/" },
      { name: "twitter:title", content: "O(patience) — Sorting Algorithm Visualizer" },
      { name: "twitter:description", content: "Visualize & quiz yourself on Bubble, Selection, Insertion, Merge, and Quick Sort. Step through algorithms frame-by-frame with live complexity stats and sound." },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/pAFyLptvTqTlzw6tuE6HWBExBnr1/social-images/social-1780541109126-O(patience).webp" },
      { name: "twitter:creator", content: "@Abhirai2006" },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://sortpatience.com/" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,500&family=JetBrains+Mono:wght@400;600&family=Caveat:wght@600&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": "https://sortpatience.com/#website",
                url: "https://sortpatience.com/",
                name: "O(patience)",
                description: "An interactive sorting algorithm playground.",
                author: { "@type": "Person", name: "Abhirai", url: "https://github.com/Abhirai2006" }
              },
              {
                "@type": "LearningResource",
                name: "O(patience) — Sorting Algorithm Visualizer",
                url: "https://sortpatience.com/",
                description: "Step through Bubble, Selection, Insertion, Merge, and Quick Sort frame-by-frame.",
                educationalLevel: "Beginner to Intermediate",
                learningResourceType: "Interactive simulation",
                teaches: ["Bubble Sort","Selection Sort","Insertion Sort","Merge Sort","Quick Sort","Big-O notation"],
                isAccessibleForFree: true,
                inLanguage: "en",
                author: { "@type": "Person", name: "Abhirai", url: "https://github.com/Abhirai2006" }
              }
            ]
          }) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideFooter = pathname.startsWith("/embed");

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {!hideFooter && <Footer />}
    </QueryClientProvider>
  );
}
