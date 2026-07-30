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
/**
 * v6 (2026-07-30, P4 queue UI + first session): player/object insertion returns
 * typed outcomes; wrinkle insertion carries durable provenance and urgent ordering;
 * moving pins cards; remove/stop/receipt-backed undo preserve exact card identity
 * and suppression; system-only activities cannot leak into player pickers. The
 * application tick now folds serializable game actions, goals, the Day-1 package
 * choice, decorations, and recap state beside the sim. Both unattended and scripted
 * player goldens re-recorded.
 */
/**
 * v7 (2026-07-30, post-P4 dual-audit stabilization): stopping while travelling
 * to an anchor consumes that block instead of re-enqueueing it on the same tick;
 * player-touched/PINNED reactive cards satisfy their need without spawning an
 * AUTO duplicate. Both goldens reviewed and re-recorded.
 */
/**
 * v8 (2026-07-30, P5 save-safe spine): deterministic state now lives in a
 * versioned CareerState payload; the five unchanged PRNG streams move out of
 * SimState to the application-owned career envelope; complete P5 game fields,
 * immutable SimRules, calendar sampling, and pending-boundary work enter the
 * replay contract. Stable Goal 1 and reward IDs now match authored content.
 */
/**
 * v9 (2026-07-31, rolling routine queue): full-routine autonomy continuously
 * publishes five planned cards. Need maintenance begins below 80 and productive
 * free time uses a neutral Read activity; completing the current card refills the
 * fifth slot in the same tick. Existing v8 career envelopes migrate in place.
 */
export const ENGINE_VERSION = 9 as const;
