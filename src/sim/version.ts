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
/**
 * v10 (2026-07-31, two audits): covers BOTH behaviour changes since v9.
 *
 * 1. Stop hands off in the same tick, and the routine planner reads §7.4's suppression map
 *    (PR #4). Removing an AUTO routine card suppresses its type for 2 game-hours and
 *    stopping one for 1, exactly as the reactive planner has since v2 — v9's rolling refill
 *    re-created a removed card in the same tick, so under the default `full-routine`
 *    autonomy Remove and Stop had no lasting effect on most of the visible queue. Urgency
 *    still overrides suppression through the reactive net, so a real crisis is unaffected.
 *
 * 2. `adjacencyGranted` joins the domain event stream, emitted where an authored §6.7 pair
 *    actually pays out at a start. The audio layer needs to announce what the engine *did*
 *    rather than what the forecast predicted — the two disagree whenever the real
 *    end-to-start gap misses the pair's window, and a reward sound for a bonus that was
 *    never granted is the same class of lie as HFM's cancel-inherits-celebration.
 *
 * PR #4 deliberately left its bump to Joe (SPEC §16), on the grounds that state shape was
 * unchanged and existing saves still load — both still true. Change 2 forces a bump anyway,
 * and a version number is per-engine rather than per-change, so this one records both.
 * Nothing about that widens either change; it only stops the recorded number from
 * describing an engine that has since moved twice. Both goldens re-recorded.
 */
/**
 * v11 (2026-07-31, audit): §9.2's food mood reaches the **routine** planner.
 *
 * `refillRoutineQueue` booked `snack` for every nutrition need and never received
 * `rules` at all, so under the default `full-routine` autonomy a `proper-meals` career
 * played out byte-identically to one with no food preference — the reactive path had
 * honoured the preference since v2, which is what made the gap look covered. Food mood is
 * one of only two preferences a player is given in the identity flow, so a rolled
 * `proper-meals` now books the 30-minute meal where a grazer books the 10-minute snack.
 *
 * Neither golden moved, and that is worth recording rather than celebrating: both golden
 * careers have `foodMoodId: null`, so the suite could never have caught this and still
 * cannot. The new coverage is in `routine-queue.test.ts`.
 *
 * A career with no food preference is unchanged, so v8–v10 envelopes still stamp forward
 * in place.
 */
/**
 * v12 (2026-08-01, docs/08): stats, perks, and the activity check.
 *
 * Every activity that produces something now resolves a `d20` at start, lands a letter
 * grade at completion, and delivers the difference as one signed instant delta. `SimState`
 * gains four fields — `stats`, `statXpToday`, `perks` and `rollStream` — which is what makes
 * this a transform migration rather than a stamp-forward.
 *
 * The stream record lives in `SimState` rather than beside the five in the career envelope,
 * and that is not a preference. `step()` takes no PRNG; the five have been
 * application-owned since v8 and are drawn in `game/` at boundaries the application can
 * see, while an activity start happens inside stage 3 where it cannot. The first draft of
 * the spec specified a sixth envelope stream and was rejected on exactly this.
 *
 * The forecaster is explicitly forbidden from drawing (`StepOptions.forecast`). It runs the
 * same `step()` on cloned state, so a clone drawn forward reproduces the exact rolls the
 * real run is about to make — the projection would have embedded real future grades, and
 * SPEC §7.5's rule is that undealt randomness is treated as absent.
 *
 * Both goldens re-recorded; `content/harness-bands.json` re-derived.
 */
export const ENGINE_VERSION = 12 as const;

/**
 * Which **chapter** of the game is shipped — SPEC §19's roadmap, not the save format.
 *
 * The two version numbers answer different questions and must not be conflated.
 * `ENGINE_VERSION` bumps on any behaviour change and governs whether a save loads;
 * `GAME_VERSION` says how much of the game exists, and governs which content is allowed to
 * be live. v1 is the apartment; v2 adds the career, v3 people, v4 growth, v5 a partner,
 * v6 the editor.
 *
 * It exists because docs/08's roster is whole-game: a character carries every stat and perk
 * family the finished game will have, and `content.ts` uses this number to require that
 * anything at or below it is genuinely live and anything above it is genuinely inert.
 * Raising it is therefore the single switch that turns a chapter on — and the build fails
 * immediately if the content for that chapter is not there.
 */
export const GAME_VERSION = 1 as const;
