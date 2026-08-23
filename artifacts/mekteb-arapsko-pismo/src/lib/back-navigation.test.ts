import assert from "node:assert/strict";
import test from "node:test";
import {
  canGoBackToInternalRoute,
  goBackOr,
  markCurrentAppHistoryEntry,
} from "./back-navigation";

const markerState = (hasInternalPredecessor: boolean) => ({
  __mektebAppHistory: { app: "mekteb", hasInternalPredecessor },
});

function withBrowserHistory(
  state: unknown,
  run: (history: { backCalls: number; replaceCalls: number; state: unknown }) => void,
) {
  const originalWindow = globalThis.window;
  const history = {
    state,
    length: 9,
    backCalls: 0,
    replaceCalls: 0,
    back() {
      this.backCalls += 1;
    },
    replaceState(nextState: unknown) {
      this.state = nextState;
      this.replaceCalls += 1;
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history,
      location: { href: "https://mekteb.test/muallim/ucenik/7" },
    },
  });

  try {
    run(history);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
}

test("interni A → B vraća browser Back tačno jednom", () => {
  withBrowserHistory(markerState(true), (history) => {
    let fallbackCalls = 0;
    goBackOr(() => {
      fallbackCalls += 1;
    });

    assert.equal(history.backCalls, 1);
    assert.equal(fallbackCalls, 0);
  });
});

test("direktno otvoren ekran koristi fallback čak i kad postoji vanjska historija", () => {
  withBrowserHistory(markerState(false), (history) => {
    let fallbackCalls = 0;
    goBackOr(() => {
      fallbackCalls += 1;
    });

    assert.equal(history.backCalls, 0);
    assert.equal(fallbackCalls, 1);
  });
});

test("neoznačeno stanje ne smatra se internim prethodnikom", () => {
  assert.equal(canGoBackToInternalRoute(null), false);
  assert.equal(canGoBackToInternalRoute({ otherApp: true }), false);
  assert.equal(canGoBackToInternalRoute(markerState(true)), true);
});

test("refresh ne duplira marker, a direktan ekran dobije sigurni početni marker", () => {
  withBrowserHistory({ preserved: "value" }, (history) => {
    markCurrentAppHistoryEntry();
    assert.equal(history.replaceCalls, 1);
    assert.equal(canGoBackToInternalRoute(history.state), false);

    markCurrentAppHistoryEntry();
    assert.equal(history.replaceCalls, 1);
  });
});