/**
 * Backwards-compatible P19 entrypoint.
 *
 * P22 replaced the original select-based finder with the approved progressive
 * questionnaire, catalogue mode, Dialog/Drawer detail views and contact
 * handoff. Keep the historical CI command, but exercise the current experience
 * through the maintained browser smoke instead of duplicating stale selectors.
 */
await import("./p22-browser-smoke.mjs");
