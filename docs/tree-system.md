# Tree companion system

"Cut Today. Grow Tomorrow." The tree is the emotional centre of Vice to Value.
This document is the design the code is built to, plus the log of decisions
and visual review passes from the rebuild (2026-09-24).

## 1. Audit of the old system

| Piece | Where | What it did |
|---|---|---|
| Species list | `client/src/companions/companionData.js` `TREE_SPECIES` | 20 species (oak, cherry_blossom, pine, willow, maple, baobab, avocado, bonsai, palm, cactus, apple, lemon, banana, redwood, bamboo, olive, mango, weeping_willow, rainbow_eucalyptus, dragon_blood), each mapped to one of 10 hand-drawn "shapes". |
| Renderer | `client/src/companions/TreeSVG.jsx` (937 lines) | Hand-drawn SVG per shape, scaled by `GROWTH_SCALE[stage]`. Every user of a species had the identical tree. |
| Stage logic | `server/routes/companion.js` | `treeGrowthState` 1–5 from `users.savings_balance` thresholds $50/$150/$500/$1500. Could shrink if the balance dropped, and one typed-in number maxed it instantly. |
| Flowers / snow | same route | `hasFlowers = current streak >= 7` (vanished on the first slip), `isDecember` snow. |
| Card | `client/src/companions/CompanionCard.jsx` | Stage header, green bar = progress to next $ threshold, gold XP strip. |
| Other tree renders | `CompanionOnboarding.jsx` (3 previews), `Dashboard.jsx` ("Next stage: $X away"), `Partners.jsx` (emoji only) | |
| "Growth tree" | `server/utils.js` `LEVELS` + `companionData.LEVEL_PROGRESSIONS.tree` | The XP ladder reused tree names (Seedling, Sprout, Sapling, Young Tree, Rooted…) and the level-up toast called tree users "a Young Tree" based on XP, while the card showed a different stage name from savings. Two trees, same vocabulary, different meanings. |

**Merge:** there is now one tree. Its maturity name (Seedling → Sprout →
Sapling → Young Tree → Mature → Ancient) comes only from the server-computed
growth value. XP stays a separate, clearly labelled track ("Activity Level N",
the gold bar). The tree progression array and the tree-named XP toast were
removed. (Reason: two meanings for "Sapling" is confusing; XP measures
activity, the tree measures real progress.)

## 2. Architecture

```
server/lib/treeGrowth.js         pure growth model (tested)      -> growth, health, milestones
server/routes/companion.js       gathers inputs, persists ratchet -> GET /api/companion .growth.tree
client/src/trees/engine/         pure generator, no React (tested)-> SVG path layers
client/src/trees/TreeArt.jsx     React renderer, sway/particles/milestone animation
client/src/companions/CompanionCard.jsx  card: art + green growth bar + gold XP bar
client/src/dev/DevTrees.jsx      /dev/trees contact sheet (dev builds only)
```

### Rendering approach: parametric recursive branching with birth times

Chosen over L-systems and space colonization:

- **L-systems** grow by discrete rewriting generations, which is the 5-stage
  problem again; smooth in-between states need interpolation hacks.
- **Space colonization** gives lovely crowns, but the structure depends on the
  attractor set and iteration count. Making it monotonic in growth means
  running it to completion and replaying it, and it costs O(nodes x attractors).
- **Parametric branching** decides every random choice once, for the fully
  grown tree (the *topology*), seeded from `hash(seedBase:species)`. Each
  branch gets a `birth` and `dur`; its length at growth G is
  `len * easeOut((G - birth) / dur)`. Evaluation only reads the topology,
  so the result is deterministic, **structurally monotonic** (nothing can
  shrink), continuous (new branches, leaves and fruit fade in rather than
  pop), and cheap (the topology is cached, evaluation is linear).

Five generators share that idea: `branching` (14 species, with pendulous
strands for willows, dichotomous forks for dragon blood, bottle trunk for
baobab, cloud pads for bonsai, bark stripes for rainbow eucalyptus),
`conifer` (pine, redwood: whorls born as the leader passes their height),
`palm` (coconut pinnate fronds; banana paddle leaves built on a curved
midrib), `cactus` (ribbed saguaro column plus arms that bud, elbow and rise),
and `bamboo` (a clump whose culms emerge centre-out). Every visual
difference lives in `species.js` parameters; generators never branch on
species id.

**Output:** `generateTree({ species, seed, growth, health, season, features })`
returns ~8–13 merged path layers (one `<path>` per colour), a fit scale,
bounds, decoration anchors, falling-leaf particles and stats. Leaves are
toned into 4 buckets by position relative to an upper-left light, with a
darker "back" bucket drawn *behind* the branches for depth.

**Fit:** computed once per topology at full growth, so every growth value
uses the same scale: young trees are visibly small, grown trees never clip.

### Seeding

`seedBase` = first 32 bits of `sha256("vt-tree:" + userId)` (server); client
seed = `hashString(seedBase + ":" + species)`. Unique per user and species,
stable forever. A test pins the hash so a refactor can't silently give every
user a new tree.

## 3. What drives growth

```
moneyMoved  = heldSavings + debtPaid
  heldSavings = best 7-snapshot rolling minimum of the combined savings
                history (+ today's balance); <7 samples -> minimum of them
  debtPaid    = SUM(debt_payments.amount > 0)
moneyScore       = log1p(money/40) / log1p(5000/40)            (saturates at $5,000)
consistencyScore = 0.6 * sat(loggedDays, 365) + 0.4 * sat(bestStreak, 90)
                   sat(x,k) = min(1, log1p(x)/log1p(k))
target  = 0.55 * moneyScore + 0.45 * consistencyScore           (0..1)
growth  = ratchet: max(stored, min(target, stored + 0.06 * elapsedDays))
          elapsedDays capped at 2
```

- **Real money only.** No "you would have spent $X" projections. Savings
  count once they have been *held*: a one-day spike can't count.
- **Consistency** = distinct days with any entry up to today (in the user's
  timezone) and the best-ever clean streak (all vices logged at 0), which a
  relapse can never take away.
- **Monotonic.** The stored peak (`companion_state._growth.g`) never goes
  down. Falling savings or deleted entries lower the *target*, never the tree.
- **Hard to game.** Growth rises at most 0.06 per day, and idle time banks at
  most 2 days (0.12). Refreshing the page can't beat the rate, and faking a
  big balance buys at most a few percent before it has to be held for a week.
  `_growth` is server-owned: PUT strips it from client bodies and keeps the
  stored copy; partners never see it.
- Both halves matter: money alone caps at 0.55 and logging alone at 0.45.

### Health (dormancy, never death)

`health = 0.25 + 0.75 * logRatio * (0.55 + 0.45 * cleanRatio)` over the last
7 days (the window shrinks for accounts younger than a week; day-one accounts
start at 0.85). Logging a slip honestly still keeps the tree around 0.66.
Low health means fewer visible leaves (never under ~30%), muted colour, and
no falling-leaf particles. Size, branches, fruit and milestones are
untouched, and it recovers as soon as logging resumes. The card chip says
"Resting · log to wake it". There are no shame mechanics: no dying, no red,
no lost progress.

### Milestones and history

Reached once, kept forever (`_growth.reached[key] = timestamp`):

| Key | When | Visible as |
|---|---|---|
| sprout / sapling / young / mature / ancient | growth 0.1 / 0.25 / 0.45 / 0.65 / 0.9 | maturity name |
| first_bloom / full_bloom | best streak 7 / 30 | blossoms (species-appropriate: flowers, catkins on oak/willow, candles on conifers, inflorescences on palm/bamboo, the purple bell on banana) |
| first_fruit / harvest | $500 / $2,500 moved | fruit (acorns, apples, lemons, mango, olives, avocados, cherries, cones, coconuts, banana bunch, berries, pods) |
| ring_1/3/6/12/24 | months since first entry or signup | growth-ring seal (one ring per month) in the card |
| new growth | growth rose in the last 7 days | bright fresh-leaf tips |

**Animation fires once per milestone.** The server returns
`pendingCelebrations` (reached but not celebrated). The card plays them one
at a time (warm glow, a small lift, rising sparkles, a label) and POSTs
`/api/companion/celebrated`, which records the key. Keys that are unknown or
not yet reached are ignored. The first time a pre-existing tree passes
through the model, everything it has already earned is marked celebrated, so
deploy day doesn't set off a burst of animations.

### Ambient life

- Sway: the wood and leaf layers are separate `<svg>` elements animated with
  CSS `skewX` from the trunk base; the canopy moves slightly more than the
  wood. Only compositor transforms are used, so there are no repaints.
- Falling leaves and petals: 3 seeded particles per tree on long, staggered
  loops, only when health >= 0.5 and growth >= 0.25.
- Season from the real date (northern-hemisphere months): spring freshens,
  autumn turns deciduous species (maple most), winter cools the palette,
  thins deciduous canopies and adds soft snow caps.
- `prefers-reduced-motion`: CSS disables sway, particles, glow and sparkles,
  and JS skips rendering particles. The milestone label still shows, without
  movement.

### Continuity for existing users

- Species, pot, decoration and background are untouched (all 20 species are
  supported). The editor now opens on the user's saved state instead of
  resetting to defaults, which used to silently switch everyone who saved it
  back to oak.
- A tree with no `_growth` predates the model. On its first GET it starts at
  `legacyTreeFloors[species][oldStage]`: the smallest growth where the new
  tree is at least 92% of the old stage art's height for 8 seeds, and never
  a younger-sounding name than the old stage (stage 5 "Rooted" maps to at
  least "Mature"). Capped at 0.9 to leave room to grow.
  `scripts/calibrate-tree-floors.mjs` regenerates the table after any
  species tuning, and the engine test fails if a floor stops holding.
- New companions are initialised at `g = 0` by PUT, so they start as honest
  seedlings.

**No migration.** Growth state lives in the existing `users.companion_state`
JSONB under the server-owned `_growth` key, so there's no schema change and no
migration file.

## 4. Performance

Measured on this dev machine in Chromium, warm cache, growth 1
(`/dev/trees` perf table):

| | min | typical | max |
|---|---|---|---|
| generation | 0.1 ms (banana, cactus) | 1–3 ms | ~4.5 ms (oak, maple) |
| leaves drawn | 0 (cactus) | 550–640 | 640 (cap) |
| geometry nodes | 5 | 750–1,150 | ~1,220 |
| DOM `<path>` elements | 5 | 8–10 | 13 |
| path data | 5 KB | 60–120 KB | ~125 KB |

Budgets enforced by tests: <=640 leaves (per-species caps), <=1,600 nodes,
<=32 layers, <=260 KB path data, and warm generation averaging <12 ms in
Node (about 4x headroom for a mid-range phone). Generation is memoized
(`useMemo` on rounded inputs; topology LRU of 48). Measured on the dashboard
in demo mode: CLS 0.013 desktop and 0.0006 mobile, none of it from the tree
card. The main bundle grew about 24 kB minified (12.6 kB gzipped). The
>500 kB chunk warning already existed (591 kB at HEAD).

## 5. Decisions (one line each)

- Parametric branching over L-system or space colonization: continuous, monotonic by construction, cheap (see §2).
- Kept all 20 existing species, not the 8 in the brief: existing users must keep their species.
- 5 generators, not one: palm, cactus, bamboo and conifers aren't branching trees and read wrong when faked.
- Growth state in `companion_state._growth` instead of a new table: no migration needed, and the server strips client writes.
- Held-savings (7-snapshot minimum) plus a daily rate cap: a balance spike or refresh-spam can't max the tree.
- Debt paid counts as money moved: paying down debt is real progress.
- Health floor 0.25 and honest slips ~0.66: logging is what's rewarded, and the tree never looks dead.
- Few-leaf species (banana) go dormant by colour only: dropping big leaves read as damage.
- Juvenile tip leaves survive dormancy: young dormant trees otherwise looked bare.
- Cherry saplings wear green leaves and bloom as they mature: pink dots on a bare stick read as a dead twig.
- Species-appropriate "blossoms" (catkins, candles…): white daisies on an oak looked pasted on.
- Fruit capped at 14 visible, milestone flowers at 40: more read as a coloured blob, not abundance.
- Legacy floors also respect old stage names: height-only floors made a stage-5 cactus a "Sprout".
- Tree maturity names come only from growth; XP toast for tree users says "Activity Level N": one meaning per word.
- New "Match App Theme" background (transparent): trees can sit on the themed card surface; existing scene backgrounds kept.
- Decorations hang off generated anchor points (limb, trunk top, crown bounds), so they stay attached as the tree grows.
- Seasons assume the northern hemisphere: no location data is collected.
- Playwright installed as a root devDependency: Vercel's build only installs `server/` and `client/`, so deploys are unaffected.
- Contact-sheet screenshots are local-only (gitignored, ~14 MB as JPEG q60): regenerated from `/dev/trees` rather than committed.
- Dev route mounted from `main.jsx` behind `import.meta.env.DEV`: tree-shaken out of production (verified, no trace in `dist/`).

## 6. Visual review log

Screenshots come from `node scripts/tree-screens.mjs`, which captures the
`/dev/trees` contact sheet from the Vite dev server. They are local-only:
`docs/tree-screens/` is gitignored, so regenerate the sheets for all 8
themes at desktop and mobile widths whenever you need them. (The brief said
4 themes; the app has 8, and all were checked.)

**Pass 0 (Node preview via sharp, oak then all species).** Oak read as a
bare pole when young, with the canopy only appearing after 0.7 and a
Y-shaped crown. Fixes: earlier branch births, girth lagging length,
juvenile tip clusters, clusters from depth 3. Maple, avocado, eucalyptus
and baobab were lollipops or sticks: trunks shortened and crowns lowered and
widened. Pine and redwood looked like fishbones: longer, wider boughs and
backing masses. Bonsai had no pads: 11-leaf flattened pads with a mass. The
cactus spine grid looked dotty: halved and softened. Perf: formatting
floats was 90% of the cost; an integer formatter made stamping 7x faster.

**Pass 1 (browser, emerald + mint).** Seedlings invisible at g 0–0.1 (pine,
palm, banana, cherry): G0 raised 0.06→0.1, bigger juvenile leaves, faster
conifer whorl fill. Winter snow drew as white scratches: replaced with 18
soft dome caps. Oak "blossoms" looked like daisies: species-appropriate
blossom forms. Milestone label ballooned into a blob on small art: compact
single line with ellipsis. Cherries too red and too many. Willow strands
looked like straw: darker twigs, less yellow. Dragon blood umbrella thin:
wider rosette leaves, visible mass. Dormant banana looked torn: colour-only
dormancy.

**Pass 2 (emerald + mint).** Young cherry still a bare dark twig: green
juvenile leaves, blossoms with maturity, lighter bark. Pine limbs crossed
the needles like ribs: limbs moved behind the foliage, pad jitter. Dormant
young trees (dragon blood) looked dead: juvenile leaves survive dormancy.

**Pass 3 (emerald, mint, neon, pink).** Cherry now tells a growth story;
pine reads as a layered fir in every theme; label fixed. Continuity test
caught wide oak and apple seeds 9% short of the old stage-5 height: crowns
narrowed, floors recalibrated, stage-name floors added.

**Pass 4 (plum, orange, dashboard in demo mode).** On the real dashboard
the demo user's rainbow eucalyptus looked wispy at 71%: crown widened and
densified. Full-harvest lemon was a yellow blob: fruit/flower caps. Mobile
contact sheet overflowed horizontally (dev perf table only): made
scrollable.

Final sheets: every species is recognisable at card size, growth reads
from seedling to crown, dormant trees read as resting (not dead), and
nothing clips or floats. Colours hold on the light mint theme and on the
darkest (noir, neon) themes.

## 7. How to run

```
node --test client/src/trees/engine/engine.test.mjs   # determinism, budgets, monotonic, fit, dormancy, continuity
node --test server/lib/treeGrowth.test.js             # growth model, ratchet, anti-gaming, milestones
npm run dev:client  ->  http://localhost:5173/dev/trees?theme=mint&bg=theme&animate=1
node scripts/tree-screens.mjs [--themes a,b] [--viewport mobile] [--sections] [--out dir]
node scripts/calibrate-tree-floors.mjs                 # after tuning species params
```

Locally, the app itself needs `VITE_CLERK_PUBLISHABLE_KEY`; the `/dev/trees`
sheet does not.

## 8. Next

- Hemisphere-aware seasons from the user's timezone.
- Server-rendered share image of the user's actual tree for the Share button.
- Ring seal tap target: open the journey timeline.
- If more species come, lazy-load the engine chunk off the dashboard path.
