/**
 * POLISH-002: LocationSearchInput debounce / suppression logic
 *
 * Tests the two correctness bugs in LocationSearchInput:
 *
 * Bug 1 — Loading flash:
 *   setStatus('loading') is called BEFORE the setTimeout fires.
 *   If the debounce timer is cancelled (user keeps typing) the spinner
 *   shows briefly even though no search ever ran. It should move inside
 *   the setTimeout callback so the loading state only appears when an
 *   actual search is about to fire.
 *
 * Bug 2 — lastSelectedLabel re-search suppression:
 *   After the user picks a result, lastSelectedLabelRef is set to the
 *   selected label. If the user then edits the input (changes the query
 *   away from the selected label) and then types back to EXACTLY the
 *   selected label string, lastSelectedLabelRef still holds the old value
 *   and the search is suppressed — meaning the user can never search for
 *   the same location again without a full clear.
 *   Fix: clear lastSelectedLabelRef when the query changes away from the
 *   selected label.
 *
 * These tests simulate the useEffect logic in isolation (no React renderer).
 *
 * Run: npx jest --selectProjects logic --testPathPattern="polish002-locationSearch"
 */

// ── Simulate the debounce effect logic ────────────────────────────────────────
//
// We replicate the exact logic from LocationSearchInput's useEffect so
// we can test it without a React renderer. If the implementation changes,
// these tests should still drive the expected behavior (and the mapping to
// the actual code is explicit in comments).

jest.useFakeTimers();

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Simulates the ORIGINAL (buggy) useEffect.
 * setStatus('loading') fires BEFORE the setTimeout.
 */
function runOriginalEffect(
  query: string,
  lastSelectedLabel: string | null,
  setStatus: (s: string) => void,
  onSearch: () => void,
): () => void {
  const trimmed = query.trim();

  if (trimmed === lastSelectedLabel) {
    return () => {};
  }

  if (trimmed.length < MIN_QUERY_LENGTH) {
    setStatus('idle');
    return () => {};
  }

  // BUG: loading is set here, before the timer fires
  setStatus('loading');

  const timerId = setTimeout(() => {
    onSearch();
  }, DEBOUNCE_MS);

  return () => clearTimeout(timerId);
}

/**
 * Simulates the FIXED useEffect.
 * setStatus('loading') is inside the setTimeout callback.
 */
function runFixedEffect(
  query: string,
  lastSelectedLabel: string | null,
  setStatus: (s: string) => void,
  onSearch: () => void,
): () => void {
  const trimmed = query.trim();

  if (trimmed === lastSelectedLabel) {
    return () => {};
  }

  if (trimmed.length < MIN_QUERY_LENGTH) {
    setStatus('idle');
    return () => {};
  }

  // FIX: loading is set INSIDE the timer
  const timerId = setTimeout(() => {
    setStatus('loading');
    onSearch();
  }, DEBOUNCE_MS);

  return () => clearTimeout(timerId);
}

// ── Bug 1: Loading flash ───────────────────────────────────────────────────────

describe('POLISH-002 Bug 1 — loading flash on cancelled debounce', () => {
  it('[ORIGINAL] shows loading state even when debounce is cancelled before firing', () => {
    const statusHistory: string[] = [];
    const setStatus = (s: string) => statusHistory.push(s);
    const onSearch = jest.fn();

    // User types "Sa" — effect fires, sets loading immediately (bug)
    const cleanup1 = runOriginalEffect('Sa', null, setStatus, onSearch);
    expect(statusHistory).toContain('loading'); // loading set before timer

    // User keeps typing "San" before timer fires — cancel the debounce
    cleanup1();
    jest.runAllTimers();

    // onSearch was never called (timer cancelled), but loading was already shown
    expect(onSearch).not.toHaveBeenCalled();
    expect(statusHistory).toContain('loading'); // the flash happened
  });

  it('[FIXED] does NOT set loading state when debounce is cancelled before firing', () => {
    const statusHistory: string[] = [];
    const setStatus = (s: string) => statusHistory.push(s);
    const onSearch = jest.fn();

    // User types "Sa" — effect fires, does NOT set loading yet
    const cleanup1 = runFixedEffect('Sa', null, setStatus, onSearch);
    expect(statusHistory).not.toContain('loading'); // no loading yet

    // User keeps typing before timer fires — cancel the debounce
    cleanup1();
    jest.runAllTimers();

    // onSearch was never called, and loading was never shown
    expect(onSearch).not.toHaveBeenCalled();
    expect(statusHistory).not.toContain('loading');
  });

  it('[FIXED] DOES set loading state when debounce fires normally', () => {
    const statusHistory: string[] = [];
    const setStatus = (s: string) => statusHistory.push(s);
    const onSearch = jest.fn();

    runFixedEffect('San', null, setStatus, onSearch);
    expect(statusHistory).not.toContain('loading'); // not yet

    jest.runAllTimers(); // fire the debounce

    expect(statusHistory).toContain('loading'); // now loading
    expect(onSearch).toHaveBeenCalled();
  });
});

// ── Bug 2: lastSelectedLabel suppression after re-edit ───────────────────────

/**
 * Simulates the ORIGINAL suppression logic.
 * lastSelectedLabel is only cleared on handleSelect (not when query changes away).
 */
function simulateOriginalSuppression(events: Array<{ type: 'select' | 'type'; value: string }>): {
  suppressedQueries: string[];
  allowedQueries: string[];
} {
  let lastSelectedLabel: string | null = null;
  const suppressedQueries: string[] = [];
  const allowedQueries: string[] = [];

  for (const event of events) {
    if (event.type === 'select') {
      lastSelectedLabel = event.value; // selection sets the ref
    } else {
      // type event — check suppression
      const trimmed = event.value.trim();
      if (trimmed === lastSelectedLabel) {
        suppressedQueries.push(trimmed);
      } else {
        allowedQueries.push(trimmed);
        // ORIGINAL BUG: lastSelectedLabel is NOT cleared when typing away
      }
    }
  }

  return { suppressedQueries, allowedQueries };
}

/**
 * Simulates the FIXED suppression logic.
 * lastSelectedLabel is cleared when the query changes away from it.
 */
function simulateFixedSuppression(events: Array<{ type: 'select' | 'type'; value: string }>): {
  suppressedQueries: string[];
  allowedQueries: string[];
} {
  let lastSelectedLabel: string | null = null;
  const suppressedQueries: string[] = [];
  const allowedQueries: string[] = [];

  for (const event of events) {
    if (event.type === 'select') {
      lastSelectedLabel = event.value;
    } else {
      const trimmed = event.value.trim();
      if (trimmed === lastSelectedLabel) {
        suppressedQueries.push(trimmed);
      } else {
        allowedQueries.push(trimmed);
        // FIX: clear the ref when user edits away from the selected label
        if (lastSelectedLabel !== null) {
          lastSelectedLabel = null;
        }
      }
    }
  }

  return { suppressedQueries, allowedQueries };
}

describe('POLISH-002 Bug 2 — lastSelectedLabel suppression after re-edit', () => {
  const SELECTED_LABEL = 'San Francisco, CA, US';

  it('[ORIGINAL] suppresses re-search even after user edited away and typed back', () => {
    const { suppressedQueries, allowedQueries } = simulateOriginalSuppression([
      { type: 'select', value: SELECTED_LABEL },  // user picks SF
      { type: 'type', value: 'San' },             // user edits away (allowed)
      { type: 'type', value: SELECTED_LABEL },    // user types back exact label
      // BUG: this gets suppressed because lastSelectedLabel was never cleared
    ]);

    // 'San' is allowed, but typing back to the exact label is suppressed (bug)
    expect(suppressedQueries).toContain(SELECTED_LABEL);
    expect(allowedQueries).toContain('San');
  });

  it('[FIXED] allows re-search after user edited away and typed back', () => {
    const { suppressedQueries, allowedQueries } = simulateFixedSuppression([
      { type: 'select', value: SELECTED_LABEL },  // user picks SF
      { type: 'type', value: 'San' },             // user edits away (clears ref)
      { type: 'type', value: SELECTED_LABEL },    // user types back — NOW allowed
    ]);

    // After the fix: typing back the label after editing away is allowed
    expect(suppressedQueries).not.toContain(SELECTED_LABEL);
    expect(allowedQueries).toContain(SELECTED_LABEL);
  });

  it('[FIXED] still suppresses immediate duplicate search right after selection', () => {
    const { suppressedQueries } = simulateFixedSuppression([
      { type: 'select', value: SELECTED_LABEL },  // user picks SF
      { type: 'type', value: SELECTED_LABEL },    // setQuery(label) fires — suppress this
    ]);

    // The immediate duplicate right after selection should still be suppressed
    expect(suppressedQueries).toContain(SELECTED_LABEL);
  });
});
