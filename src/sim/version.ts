/**
 * Bumped explicitly on any behavior-affecting sim change once golden replays exist
 * (P2+). Not churned during the initial unshipped P1 build.
 */
/**
 * v2 (2026-07-30, P2 critic round 1): bedtime window open-ended; new AUTO/urgent
 * cards enter the earliest run; anchor blocks hold the mid tier; running cards are
 * never evicted/cleaned; adjacency gaps measured at the second activity's START,
 * it-sticks replaces itself and fires unattended; practice multipliers (m_out,
 * fresh-mind, minty, hygiene focus) sampled at start. Golden re-recorded.
 */
export const ENGINE_VERSION = 2 as const;
