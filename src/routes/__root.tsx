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
import { reportRuntimeError } from "../lib/runtime-error-reporting";

const APP_NAME = "TXPPS TX-80";
const APP_DESCRIPTION =
  "TXPPS TX-80 is an original expressive dual-layer polyphonic web synthesizer with ribbon control, portamento, glissando, and preset recall.";
const THEME_COLOR = "#1a1a17";

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
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
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
      { name: "theme-color", content: THEME_COLOR },
      { name: "msapplication-TileColor", content: THEME_COLOR },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: "TX-80" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: APP_NAME },
      { name: "description", content: APP_DESCRIPTION },
      { name: "author", content: "TXPPS" },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:image", content: "/icons/icon-512.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: APP_NAME },
      { name: "twitter:description", content: APP_DESCRIPTION },
      { name: "twitter:image", content: "/icons/icon-512.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48x48.png" },
      { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "mask-icon", href: "/safari-pinned-tab.svg", color: "#7dff9a" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
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
