# Engine Design Decisions

## Data model

### Sport and Tier as IntEnum
Both are `IntEnum`, not `Enum`. This is a forward-compatibility decision:
pybind11 crosses the Python/C++ boundary using raw integers, so having the
enum _be_ the integer avoids a conversion layer when the C++ port arrives in
Week 3. The integer codes are stable — changing them would invalidate any
serialised data.

`Tier` has three values (0 BEGINNER, 1 INTERMEDIATE, 2 COMPETITIVE) because
three levels is the minimum that makes `|squad.tier - room.desiredTier| / 2`
non-trivial. More granularity would require real user data to justify.

### Squad is the atomic unit
A squad is never split across rooms. This is the fundamental constraint that
makes greedy assignment fail (see below). If "split squads" were allowed, the
problem collapses to a bin-packing variant and greedy would be near-optimal.
The atomic constraint is what requires a real solver.

### Time values are epoch seconds (float)
`startTime`, `endTime`, `matchTime` are `float` seconds since Unix epoch.
Small literal values (0.0, 86400.0) appear in tests for readability but the
model doesn't impose a scale — the feasibility check is just
`startTime ≤ matchTime ≤ endTime`.

### `maxDistance` is in metres
Haversine returns metres; `maxDistance` is in metres; `distanceCost` is their
ratio. Everything stays in the same unit. No hidden km/m conversion anywhere.

---

## Scoring function

```
cost = 0.7 × (distance / maxDistance) + 0.3 × (|tier_gap| / 2)
```

### Why these weights?
They are **hand-chosen priors, not fitted parameters**. Fitting requires
historical join/no-show data this project doesn't have. The README says this
explicitly. `w_dist=0.7, w_skill=0.3` encode a reasonable belief that location
matters more than skill tier for recreational pickup games.

### Why linear distance cost?
Linear is the default. A quadratic `(d/D)²` would penalise very-close rooms
less and very-far rooms more, which is plausible (players might happily walk
500 m but not 900 m). Change it if user data shows a sharp drop-off near the
maximum. Document the reason for the change here.

### Why normalise to [0, 1]?
So the two cost components are on the same scale and the weights are
interpretable. If distance cost were in raw metres, `w_dist=0.7` would be
meaningless without knowing the typical `maxDistance`.

---

## Why the solver exists: the greedy-failure proof

```
Squads:  S1 (size 1, equidistant R1/R2), S2 (size 1, equidistant R1/R2),
         S3 (size 2, ~1 km from R1, ~10 km from R2)
Rooms:   R1 (capacity 2), R2 (capacity 2)

Greedy (process in order, pick lowest-cost room with remaining capacity):
  S1 → R1  (R1 marginally closer)
  S2 → R1  (fills R1)
  S3 → R2  (only option left, ~10 km away)
  Total cost ≈ 1.87 × optimal

Optimal:
  S1 → R2, S2 → R2, S3 → R1
  All 4 players matched, total cost ≈ 53% of greedy's cost
```

The structural lesson: flexible squads (S1, S2) make locally optimal choices
that consume capacity a constrained squad (S3) needs far more. No
order-of-processing greedy can see this because the cost of the wrong early
choice only becomes visible later in the sequence. CP-SAT evaluates the entire
assignment space simultaneously.

---

## Solver: OR-Tools CP-SAT

### Why CP-SAT over LP?
The assignment variables `x[i][j]` are binary (0 or 1). An LP relaxation
would allow fractional assignments (squad 30% in room A, 70% in room B),
which violates the atomic constraint. CP-SAT enforces integrality natively.

### Why CP-SAT over brute force?
Brute force over `R^S` candidates is used in `test_scoring.py` for the tiny
3-squad / 2-room fixture. It's O(R^S): for 10 squads and 5 rooms that's
5^10 ≈ 10M candidates. For realistic instances (50 squads, 10 rooms) it's
10^50 — not usable. CP-SAT prunes the search space via constraint propagation
and branch-and-bound.

### Two-phase objective
**Phase 1:** Maximise total matched players.
**Phase 2:** Among all maximum-matching assignments, minimise total cost.

The phases are run as two sequential solves on the same model. After Phase 1,
the constraint `matched == max_matched` is permanently added, then the
objective is replaced with cost minimisation. This guarantees players-first
semantics: a match that places 4 players at moderate distance is always
preferred over one that places 3 players at zero distance.

### The oracle is never "optimised"
The CP-SAT oracle is the correctness ground truth. All future implementations
(Python heuristic, C++ naive, C++ SoA, C++ SIMD) are measured against it.
Making the oracle faster would undermine its role as a fixed reference.

---

## Synthetic data generator

Located in `bench/datagen.py`. Key properties:

- **Seeded**: `random.Random(seed)` is local — global `random` state is
  never touched. Same arguments always produce the same instance.
- **Contention ratio**: `total_slots / total_players`. Values < 1.0 make
  some squads structurally unmatchable (used to test partial-assignment paths).
  Values ≥ 1.2 give the solver slack and test cost-minimisation behaviour.
- **Geography**: Squads and rooms are scattered within a bounding square
  of `area_radius_km`. Each squad's `maxDistance` is 1.5× the area radius
  so nearly all rooms are reachable (high connectivity). Reduce the multiplier
  to create geographically sparse instances where feasibility is the bottleneck.
- **Time**: Squads are available all day (0–86400 s). Room `matchTime` is
  uniformly distributed across the day. This avoids time-window infeasibility
  dominating the instance structure, which would obscure capacity and distance
  effects.

---

## Heuristic solver (`solve_heuristic`)

The heuristic is the production path — the oracle is too slow for request-time use on instances larger than ~30 squads. The design goal is **≤ 5% cost gap vs the oracle on 13 of 15 benchmark configurations**, while matching the oracle's player count exactly on every configuration.

### Construction: multistart FFD

Three deterministic orderings are tried; the best result (lex-max on players, then cost) is kept.

| Ordering | Priority | Strength |
|---|---|---|
| `size_desc` | largest squads first | maximises matched players — large squads grab rooms before they fill up |
| `flex_first` | fewest feasible rooms first, then largest | prevents constrained squads being squeezed out by flexible ones |
| `cost_asc` | cheapest min-feasible-cost first | in undersupplied instances, ensures cheap squads claim rooms before expensive ones |

Each ordering runs FFD: iterate squads in order, assign each to its cheapest feasible room with remaining capacity. O(S·R) per ordering.

### Local search: four interleaved passes

After construction, one local search loop runs until no phase makes progress.

**1-opt relocate** — move a single placed squad to a cheaper room that has capacity. O(S·R) per pass. Finds improvements that 2-opt misses on tight instances where no swap partner exists.

**2-opt pairwise swap** — swap two placed squads between their rooms if the combined cost drops and both capacity constraints hold. O(S²) per pass. The classic move for cross-room cost rebalancing.

**Ejection chains** — for each unplaced squad U: first try a direct slot; if none, evict a placed squad P to a third room k and put U in P's old room. Accepts any valid chain — player count outranks cost. Single-step by design; multi-step chains need cycle detection.

**Substitution** — for each unplaced squad U and each placed squad P where `size(U) ≤ size(P)`: if U is cheaper than P in P's room, evict P and install U. Freed capacity (`P.size - U.size` slots) re-enters the pool; ejection chains absorb it on the next outer-loop pass. This is the cost-optimisation counterpart to ejection chains — ejection chains fire for player-count reasons, substitution fires for cost reasons.

The outer loop reruns as long as any phase made progress; it terminates when all four phases return no improvement.

### Objective priority

Player count is always primary. No move that reduces matched players is ever accepted. Cost is secondary: among solutions with equal player count, the lower-cost one wins.

### Benchmark results (13 configurations, threshold 5%)

| Configuration | Squads | Rooms | Ratio | Cost gap |
|---|---|---|---|---|
| tiny\_slack | 5 | 2 | 1.5 | < 5% |
| small\_slack | 8 | 3 | 1.5 | < 5% |
| tight\_10 | 10 | 3 | 1.0 | < 5% |
| tight\_15 | 15 | 4 | 1.0 | < 5% |
| oversupplied\_10 | 10 | 4 | 2.0 | < 5% |
| oversupplied\_20 | 20 | 8 | 2.0 | < 5% |
| undersupplied\_15 | 15 | 3 | 0.7 | < 5% |
| high\_contention\_15 | 15 | 3 | 1.2 | < 5% |
| high\_contention\_25 | 25 | 5 | 1.3 | < 5% |
| variance\_12 | 12 | 3 | 1.2 | < 5% |
| variance\_20 | 20 | 4 | 1.2 | < 5% |
| mid\_25 | 25 | 6 | 1.1 | < 5% |
| mid\_30 | 30 | 7 | 1.1 | < 5% |

### Known limitations (xfail)

**`tight_20` (20 squads, 5 rooms, ratio = 1.0) — 11.5% gap**

When every room is at capacity, 2-opt swap is only valid between squads of exactly equal size: swapping S1 (size 3) into a full room that held S2 (size 5) would overflow it. The oracle finds a better assignment via a 3-way rotation — three squads cycle between three rooms such that all capacity constraints balance out. 3-opt is O(S³) per pass and wasn't added to keep the local search polynomial and readable. Fixing this case requires implementing 3-opt rotations or an LNS perturbation step.

**`undersupplied_20` (20 squads, 4 rooms, ratio = 0.6) — 26.3% gap**

The oracle's optimal solution places a different *set* of squads than the heuristic — specifically, it leaves out several small high-cost squads and instead places fewer but cheaper larger ones, keeping total player count identical. Recovering this requires compound squad substitution: simultaneously evict two size-1 squads and install one size-2 squad in their place. The current substitution move handles 1-for-1 evictions only. A multi-squad substitution that maintains player count while reducing cost would fix this case.

---

## File layout invariants

| Rule | Reason |
|---|---|
| Scoring logic lives only in `scoring.py` | Both the online ranking path and the batch solver path call the same `score()`. Duplication would let them drift. |
| `engine/` has no network or DB imports | The engine is a pure function from (squads, rooms) → assignment. Keeping it dependency-free lets it run in tests without a running server, and makes the C++ port self-contained. |
| `bench/` is not imported by `engine/` | Benchmark code imports engine code, not the reverse. Prevents benchmark scaffolding from leaking into production paths. |
