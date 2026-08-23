import { useBrowserLocation } from "wouter/use-browser-location";

const APP_HISTORY_KEY = "__mektebAppHistory";

type AppHistoryMarker = {
  app: "mekteb";
  /** Whether the immediately preceding entry is an app route. */
  hasInternalPredecessor: boolean;
};

type NavigationOptions = {
  replace?: boolean;
  state?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getMarker(state: unknown): AppHistoryMarker | null {
  const marker = asRecord(state)[APP_HISTORY_KEY];
  if (
    marker !== null &&
    typeof marker === "object" &&
    (marker as AppHistoryMarker).app === "mekteb" &&
    typeof (marker as AppHistoryMarker).hasInternalPredecessor === "boolean"
  ) {
    return marker as AppHistoryMarker;
  }
  return null;
}

function withMarker(
  state: unknown,
  hasInternalPredecessor: boolean,
): Record<string, unknown> {
  return {
    ...asRecord(state),
    [APP_HISTORY_KEY]: {
      app: "mekteb",
      hasInternalPredecessor,
    } satisfies AppHistoryMarker,
  };
}

/**
 * Označava početni unos aplikacije. On nema potvrđen interni prethodnik:
 * direktan URL nikada ne smije Back-om odvesti na vanjsku stranicu.
 */
export function markCurrentAppHistoryEntry(): void {
  if (typeof window === "undefined" || getMarker(window.history.state)) return;

  window.history.replaceState(
    withMarker(window.history.state, false),
    "",
    window.location.href,
  );
}

/**
 * Wouter location hook koji svaki interni push označava kao siguran korak
 * unutar aplikacije. Zamjene rute zadržavaju isti status prethodnika.
 */
export function useMektebLocation(
  options?: { ssrPath?: string },
): [string, (path: string, ...args: any[]) => void] {
  const [pathname] = useBrowserLocation(options);

  const navigate = (to: string, navigationOptions: NavigationOptions = {}) => {
    if (typeof window === "undefined") return;

    const currentMarker = getMarker(window.history.state);
    const hasInternalPredecessor = navigationOptions.replace
      ? currentMarker?.hasInternalPredecessor ?? false
      : currentMarker !== null;

    window.history[navigationOptions.replace ? "replaceState" : "pushState"](
      withMarker(navigationOptions.state, hasInternalPredecessor),
      "",
      to,
    );
  };

  return [pathname, navigate];
}

export function canGoBackToInternalRoute(state: unknown): boolean {
  return getMarker(state)?.hasInternalPredecessor === true;
}

/**
 * Vraća korisnika tačno jedan korak samo kada je prethodni unos potvrđena
 * interna ruta. Direktno otvoreni linkovi koriste fallback ekrana.
 */
export function goBackOr(fallback: () => void): void {
  if (
    typeof window !== "undefined" &&
    canGoBackToInternalRoute(window.history.state)
  ) {
    window.history.back();
    return;
  }
  fallback();
}