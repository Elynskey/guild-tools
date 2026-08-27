/**
 * The design handoff references `var(--grad-crest)` (a 2px gold top rule for "feature
 * cards") but it isn't in this app's vendored token set (src/design-system/tokens/) — only
 * `--grad-header` and `--grad-gold` are. Approximated here from the same gold ramp
 * (`--gold-300`/`--gold-500`) rather than adding an unreviewed token to the shared file.
 */
export const GRAD_CREST = 'linear-gradient(90deg, var(--gold-600), var(--gold-300), var(--gold-600))';
