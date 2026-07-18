import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center enclosure px-4">
      <div className="max-w-md text-center">
        <div className="silkscreen mb-2">TXPPS TX-80</div>
        <h1 className="readout text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-lg silkscreen-strong">Signal not found</h2>
        <p className="mt-2 text-sm text-[color:var(--silkscreen-dim)]">
          That route isn't wired to the panel.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-[color:var(--hairline-strong)] bg-[color:var(--panel-raised)] px-4 py-2 text-sm silkscreen-strong hover:bg-[color:var(--panel)]"
          >
            Return to panel
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center enclosure px-4">
      <div className="max-w-md text-center">
        <div className="silkscreen mb-2">TXPPS TX-80</div>
        <h1 className="text-xl silkscreen-strong">Panel fault</h1>
        <p className="mt-2 text-sm text-[color:var(--silkscreen-dim)]">
          The interface hit an error. Try again or return to the main panel.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md border border-[color:var(--hairline-strong)] bg-[color:var(--panel-raised)] px-4 py-2 text-sm silkscreen-strong hover:bg-[color:var(--panel)]"
          >
            Retry
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-[color:var(--hairline)] px-4 py-2 text-sm silkscreen"
          >
            Main panel
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1a17" },
      { title: "TXPPS TX-80 — Dual-Layer Web Synthesizer" },
      {
        name: "description",
        content:
          "TXPPS TX-80 is an original expressive dual-layer polyphonic web synthesizer with ribbon control, portamento, glissando, and preset recall.",
      },
      { name: "author", content: "TXPPS" },
      { property: "og:title", content: "TXPPS TX-80 — Dual-Layer Web Synthesizer" },
      {
        property: "og:description",
        content:
          "Play a real polyphonic web synthesizer: two independent layers, ribbon controller, portamento & glissando, presets, MIDI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
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

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
