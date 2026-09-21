import type { Loaded } from './useLoad';

/** The "loading / could not load / showing older data" strip every screen shares. */
export function LoadState<T>({ state, what }: { state: Loaded<T>; what: string }) {
  if (state.loading && !state.data) return <p className="muted">Loading {what}…</p>;
  if (state.error && !state.data) {
    return (
      <div className="notice bad" role="alert">
        <p>{state.error}</p>
        <button className="chip" onClick={state.refresh}>Try again</button>
      </div>
    );
  }
  if (state.error) return <p className="notice warnline" role="status">Couldn't refresh {what}: {state.error} Showing the last copy.</p>;
  return null;
}
