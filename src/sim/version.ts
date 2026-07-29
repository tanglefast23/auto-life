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
/**
 * v4 (2026-07-30, external audit round 3): the reorder verb exists (`moveCard`
 * command — moving PINS the card per §7.4's ownership row; block members detach);
 * engine resolves activities/objects ONLY through the step() content argument;
 * adjacency is truly data-driven (generic first/firstTag × second/secondTag
 * matcher + effect.kind dispatch — no pair ids in engine code); a stopped
 * practice refunds the minty payment it consumed (§6.7); stale prior-day blocks
 * also retire at the wake boundary (all-nighter path). Golden re-recorded.
 */
/**
 * v5 (2026-07-30, dual external audits / P2.1 stabilization): anchors fire AT
 * THEIR TARGET, not window-open (the day no longer runs an hour early — targetAt
 * was dead data); the §7.1 continue clause uses the normative 23:00 boundary
 * (was 22:30); Q4 consumption is monotonic (a late-starting prior-day block can
 * no longer resurrect a consumed day and duplicate an anchor); the stale-block
 * sweep removes AUTO members only (never a player-pinned sibling); practice
 * BLOCK status resets at the wake boundary; removing the running card stops it
 * (invisible continuation was possible); provenance is never rewritten so the
 * player cap counts only inserted cards. Snapshot gains `processed` (read-model;
 * fixes the travel undercount — 24 recorded vs 32 real). Golden re-recorded.
 */
export const ENGINE_VERSION = 5 as const;
