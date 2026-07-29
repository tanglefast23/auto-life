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
 *
 * v3 (2026-07-30, P2 critic round 2): urgency is live — crossing-based per-bar
 * crisis counting (urgentActive state) and promotion/demotion of queued cards
 * serving an urgent bar; anchor-block consumption keys the blockId's own day and
 * sleep-end retires stale prior-day blocks (no phantom bedtime); the planner only
 * books EFFECTIVE naps (budget-exhausted naps are never offered or reactively
 * started); §6.7 stop-cancels-bonus (it-sticks modifier, minty arming); startability
 * gates run before travel and a dropped card yields to the next; supersession-created
 * cards auto-clean at their own creation threshold (+10); player inserts past the
 * cap are rejected per-command instead of crashing the tick. Golden re-recorded.
 */
export const ENGINE_VERSION = 3 as const;
