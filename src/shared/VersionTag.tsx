/** Small, unobtrusive build version — visible everywhere so an officer can tell at a glance which build they're on. */
export function VersionTag() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        left: 10,
        zIndex: 5,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-faint)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      v{__APP_VERSION__}
    </div>
  );
}
