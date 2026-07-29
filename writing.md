# Auto Life — writing.md (the binding prose bible)

**Every authored string — storylet, journal line, why-line, recap, goal name, bubble, wrinkle text, letter, conversation beat — passes §5's checklist before it ships.** Same posture as design.md for art: this file is canon for how the game *sounds*. It gates P5 (SPEC §17). Deterministic checks can catch caps and banned phrases; voice quality still requires the mandatory editorial pass below, string by string.

---

## 1. The voice, in one paragraph

A quiet friend narrating a small life, fond but never gushing. Plain words, short sentences, concrete details. The sim's days are ordinary and the writing trusts that ordinary is enough — it never inflates a burned toast into a metaphor. Warmth comes from specificity ("the third plant this month") and restraint, not from adjectives. When in doubt: shorter, plainer, more specific.

## 2. Hard rules

1. **One idea per string.** A journal line is one observation, not an observation plus a reflection.
2. **Concrete beats abstract.** "Practiced until the streetlight came on" — never "made meaningful progress on a musical journey."
3. **No em-dash cadence.** At most one dash per string, and only when a comma genuinely fails. The dash-appositive-dash rhythm is the loudest AI tell.
4. **No rule of three.** "Tired, hungry, and happy" is banned as a reflex. Two items, or one, or an actual list in UI.
5. **Never name the feeling.** Show the yawn, not "she felt exhausted." Bubbles carry emotion via icons; text carries facts.
6. **No inflated symbolism.** Nothing "is a testament to," "marks a milestone," "speaks volumes," or "is more than just" anything.
7. **No negative parallelism.** "It wasn't the money, it was the music" — banned construction, in every variation.
8. **No hedging filler.** "Perhaps," "somehow," "a little bit of" — cut unless the uncertainty is the content.
9. **Present tense for the world, past for the journal.** UI describes now ("Fridge is empty"); the journal remembers ("Burned the toast. Ate it anyway.").
10. **Sentence fragments are welcome.** The journal is a person's notebook, not an essay. "Rain all day. Practiced twice."
11. **Numbers stay in UI chrome, never in prose.** The journal never says "+35 Nutrition"; the card already did.
12. **Names, not roles, once known.** "Rio waved from the park" — never "your athletic friend."

## 3. Per-type contracts (length caps are hard)

| Type | Cap | Register | Worked example ✓ | Counterexample ✗ (reject on sight) |
|---|---|---|---|---|
| Journal storylet | 12 words | past, fragment-friendly | "Burned the toast. Ate it anyway." | "Despite the culinary mishap, breakfast became a lesson in resilience." |
| Why-line (AUTO card) | 9 words | present, factual | "Added: Nutrition drops past 35 around 12:40." | "The planner has determined that a meal would be beneficial." |
| Recap line | 10 words | past, factual | "Skipped the workout. The shower ran long." | "A day of ups and downs — but tomorrow is a new day!" |
| Goal name | 4 words | imperative or noun phrase | "Find the rhythm" | "Embark on your wellness journey" |
| Bubble text | 6 words | present, first person | "…maybe I'll play something?" | "I am feeling somewhat unmotivated today." |
| Wrinkle intro | 14 words | present, concrete stakes | "Someone's knocking. The repair van is outside — bathroom's off-limits till nine-thirty." | "An unexpected visitor brings both challenge and opportunity to your morning routine!" |
| Letter / event card | 40 words | in-world sender's voice | "Heard you playing through the wall. The café does open-mic Thursdays. Come by. — M." | "Congratulations! An exciting new chapter of your musical career awaits you." |
| Conversation beat (v5) | 18 words per line | the speaker's voice, §4 | "You cook? My last date microwaved a steak." | "I find culinary skill to be a genuinely attractive quality in a partner." |

## 4. Character voices (one line each, binding)

The sim: hums more than talks; first-person bubbles trail off ("…"). **Rio:** short sentences, morning energy, no punctuation fuss. **Maren:** full sentences, dry, book references she doesn't explain. **Dot:** typo-casual, exclamation-prone, in-jokes. **Mates (v5):** each candidate's storylet file opens with a 3-line voice card in this format before any beat is written. One voice rule per person, never violated — voice drift across beats is the prose equivalent of silhouette drift.

## 5. The string checklist (binding)

- [ ] Under the type's word cap
- [ ] Zero banned constructions (§2.3–2.8)
- [ ] At least one concrete noun or detail; zero abstract nouns doing the work ("journey," "growth," "moment")
- [ ] Emotion shown or iconified, never named
- [ ] Reads aloud like a person; if it sounds like a greeting card or a press release, rewrite
- [ ] Consistent with the speaker's voice card (§4)
- [ ] No information the UI chrome already carries
- [ ] **The `humanizer` skill pass is mandatory, not advisory [CONFIRMED by Joe]:** before authored-string work begins, the implementer verifies the exact skill is available and records its invocation/version. Every changed batch is run through it; every flagged string is rewritten, then the whole batch re-runs this checklist. A different drafting/editing skill may help with rewrites but does **not** satisfy this gate. If `humanizer` is unavailable, authored-string work is blocked rather than silently waived.
- [ ] **The pass is auditable:** the P5 writing-review manifest records the reviewed file hashes/string IDs, pass date, and rewrites. Automated validation fails when authored files change without a current manifest entry. Debug text, test fixtures, IDs, and developer-only proof labels are excluded; anything a player reads in the shipped game is included.

## 6. Anti-patterns (instant rejection)

"More than just" · "a testament to" · "little did they know" · "in that moment" · exclamation marks outside Dot's voice · em-dash appositives · rule-of-three lists · named emotions · "journey," "chapter," "adventure" as metaphors for ordinary life · motivational-poster cadence · any string that would fit in a different game unchanged (specificity test).
