/**
 * Optional runtime error bridge for hosted editor environments.
 * No-ops in production / normal browsers — never loads third-party branding.
 */
type ErrorReportOptions = {
  maxStackLength?: number;
  maxMessageLength?: number;
};

type HostEvents = {
  captureException?: (
    error: unknown,
    hint?: Record<string, unknown>,
    options?: ErrorReportOptions,
  ) => void;
};

type HostWindow = Window & {
  __tx80HostEvents?: HostEvents;
};

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

/** Report a caught error to an optional host telemetry hook (if present). */
export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const host = window as HostWindow;
  host.__tx80HostEvents?.captureException?.(
    error,
    { mechanism: { type: "generic", handled: true, data: context } },
    { maxStackLength: 2000, maxMessageLength: 500 },
  );

  if (import.meta.env.DEV && error instanceof Error) {
    console.error("[TX-80]", truncate(error.message, 500), context);
  }
}
