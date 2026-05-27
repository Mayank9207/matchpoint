from __future__ import annotations

import math

from ortools.sat.python import cp_model

from models import Squad, Room
from scoring import is_feasible, score


_COST_SCALE = 100_000


def solve_oracle(
    squads: list[Squad],
    rooms: list[Room],
    w_dist: float = 0.7,
    w_skill: float = 0.3,
) -> tuple[dict[int, int], float]:

    S, R = len(squads), len(rooms)
    if S == 0 or R == 0:
        return {}, 0.0

    
    feasible: list[list[bool]] = [[False] * R for _ in range(S)]
    scaled_cost: list[list[int]] = [[0] * R for _ in range(S)]
    for i, sq in enumerate(squads):
        for j, rm in enumerate(rooms):
            if is_feasible(sq, rm):
                feasible[i][j] = True
                raw = score(sq, rm, w_dist, w_skill)
                scaled_cost[i][j] = int(round(raw * _COST_SCALE))

    mdl = cp_model.CpModel()
    x = [[mdl.new_bool_var(f"x_{i}_{j}") for j in range(R)] for i in range(S)]


    for i in range(S):
        mdl.add_at_most_one(x[i])

  
    for i in range(S):
        for j in range(R):
            if not feasible[i][j]:
                mdl.add(x[i][j] == 0)

    
    for j, rm in enumerate(rooms):
        mdl.add(sum(squads[i].size * x[i][j] for i in range(S)) <= rm.capacity)

    # Maximise matched players first.
    matched = sum(squads[i].size * x[i][j] for i in range(S) for j in range(R))
    mdl.maximize(matched)

    slvr = cp_model.CpSolver()
    slvr.parameters.log_search_progress = False
    status = slvr.solve(mdl)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {}, 0.0

    max_matched = int(slvr.objective_value)
    if max_matched == 0:
        return {}, 0.0
    
    # second phase to minimise total cost among all max matching solutions.
    mdl.add(matched == max_matched)
    mdl.minimize(
        sum(scaled_cost[i][j] * x[i][j] for i in range(S) for j in range(R))
    )

    status = slvr.solve(mdl)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {}, 0.0

    assignment: dict[int, int] = {}
    total_cost = 0.0
    for i in range(S):
        for j in range(R):
            if slvr.value(x[i][j]):
                assignment[i] = j
                total_cost += score(squads[i], rooms[j], w_dist, w_skill)

    return assignment, total_cost

# sorts decreasing by size, then increasing by flexibility (feasible room count), then increasing by cost
def _ffd_assign(
    order: list[int],
    squads: list[Squad],
    rooms: list[Room],
    feasible: list[list[bool]],
    cost: list[list[float]],
) -> tuple[dict[int, int], list[int]]:
   
    R = len(rooms)
    room_load = [0] * R
    assignment: dict[int, int] = {}
    for i in order:
        sq_size = squads[i].size
        best_j, best_c = None, math.inf
        for j in range(R):
            if feasible[i][j] and room_load[j] + sq_size <= rooms[j].capacity:
                if cost[i][j] < best_c:
                    best_c = cost[i][j]
                    best_j = j
        if best_j is not None:
            assignment[i] = best_j
            room_load[best_j] += sq_size
    return assignment, room_load


def _local_search(
    assignment: dict[int, int],
    room_load: list[int],
    squads: list[Squad],
    rooms: list[Room],
    feasible: list[list[bool]],
    cost: list[list[float]],
    max_iter: int,
) -> None:
   
    S = len(squads)
    R = len(rooms)

    for _ in range(max_iter):
        
        relocated = False
        for s in list(assignment.keys()):
            j = assignment[s]
            for k in range(R):
                if k == j or not feasible[s][k]:
                    continue
                if room_load[k] + squads[s].size > rooms[k].capacity:
                    continue
                if cost[s][k] < cost[s][j]:
                    room_load[j] -= squads[s].size
                    room_load[k] += squads[s].size
                    assignment[s] = k
                    j = k
                    relocated = True

        # Swap for better cost.
        swapped = False
        assigned = list(assignment.keys())
        for i1 in range(len(assigned)):
            for i2 in range(i1 + 1, len(assigned)):
                s1, s2 = assigned[i1], assigned[i2]
                r1, r2 = assignment[s1], assignment[s2]

                if r1 == r2:
                    continue
                if not feasible[s1][r2] or not feasible[s2][r1]:
                    continue

                new_load_r1 = room_load[r1] - squads[s1].size + squads[s2].size
                new_load_r2 = room_load[r2] - squads[s2].size + squads[s1].size

                if new_load_r1 > rooms[r1].capacity or new_load_r2 > rooms[r2].capacity:
                    continue
                if cost[s1][r2] + cost[s2][r1] >= cost[s1][r1] + cost[s2][r2]:
                    continue

                assignment[s1], assignment[s2] = r2, r1
                room_load[r1], room_load[r2] = new_load_r1, new_load_r2
                swapped = True

        # Try to place unassigned squads via ejection chains: unplaced u ejects placed p from j to k, freeing capacity for u in j. 
        ejected = False
        unplaced = [i for i in range(S) if i not in assignment]
        unplaced.sort(key=lambda i: squads[i].size, reverse=True)

        for u in unplaced:
            sq_size = squads[u].size

            # direct slot first — relocate/swap may have freed capacity
            best_j, best_c = None, math.inf
            for j in range(R):
                if feasible[u][j] and room_load[j] + sq_size <= rooms[j].capacity:
                    if cost[u][j] < best_c:
                        best_c = cost[u][j]
                        best_j = j
            if best_j is not None:
                assignment[u] = best_j
                room_load[best_j] += sq_size
                ejected = True
                continue

        
            best = None  # (delta, p, room_u, room_p)
            for j in range(R):
                if not feasible[u][j]:
                    continue
                needed = room_load[j] + sq_size - rooms[j].capacity
                if needed <= 0:
                    continue
                candidates = [s for s, r in assignment.items() if r == j and squads[s].size >= needed]
                for p in candidates:
                    for k in range(R):
                        if k == j or not feasible[p][k]:
                            continue
                        if room_load[k] + squads[p].size > rooms[k].capacity:
                            continue
                        delta = cost[u][j] + cost[p][k] - cost[p][j]
                        if best is None or delta < best[0]:
                            best = (delta, p, j, k)

            if best is not None:
                _, p, room_u, room_p = best
                # accept any valid chain — player count beats cost in priority
                room_load[room_u] -= squads[p].size
                room_load[room_u] += sq_size
                room_load[room_p] += squads[p].size
                assignment[u] = room_u
                assignment[p] = room_p
                ejected = True

        # ── substitution ─────────────────────────────────────────────────
        # Replace placed squad p with unplaced u in the same room, only when
        # size(u) >= size(p) so player count never drops. Without this guard,
        # swapping a small u for a large p loses players that can't be
        # recovered on undersupplied instances where every unplaced squad
        # has already failed direct placement and ejection rescue.
        substituted = False
        unplaced_snapshot = [i for i in range(S) if i not in assignment]
        for u in unplaced_snapshot:
            if u in assignment:
                continue  # u may have been installed earlier in this pass
            best_sub = None
            for p, j in list(assignment.items()):
                if not feasible[u][j]:
                    continue
                if squads[u].size < squads[p].size:
                    continue
                new_load = room_load[j] - squads[p].size + squads[u].size
                if new_load > rooms[j].capacity:
                    continue
                saving = cost[p][j] - cost[u][j]
                if saving > 0 and (best_sub is None or saving > best_sub[0]):
                    best_sub = (saving, p, j)
            if best_sub is not None:
                _, p, j = best_sub
                room_load[j] += squads[u].size - squads[p].size
                assignment[u] = j
                del assignment[p]
                substituted = True

        if not relocated and not swapped and not ejected and not substituted:
            break


def solve_heuristic(
        squads: list[Squad],
        rooms: list[Room],
        w_dist: float = 0.7,
        w_tier: float = 0.3,
        max_iter: int = 100,
) -> tuple[dict[int, int], float]:
 
    S = len(squads)
    R = len(rooms)
    if S == 0 or R == 0:
        return {}, 0.0

    feasible: list[list[bool]] = [[False] * R for _ in range(S)]
    cost: list[list[float]] = [[0.0] * R for _ in range(S)]
    for i, sq in enumerate(squads):
        for j, rm in enumerate(rooms):
            if is_feasible(sq, rm):
                feasible[i][j] = True
                cost[i][j] = score(sq, rm, w_dist, w_tier)

    # Heuristic orderings: by size, by flexibility (feasible room count), and by cost.
    flexibility = [sum(feasible[i][j] for j in range(R)) for i in range(S)]
    min_cost = [
        min((cost[i][j] for j in range(R) if feasible[i][j]), default=math.inf)
        for i in range(S)
    ]
    size_order = sorted(range(S), key=lambda i: squads[i].size, reverse=True)
    flex_order = sorted(range(S), key=lambda i: (flexibility[i], -squads[i].size))
    cost_order = sorted(range(S), key=lambda i: (min_cost[i], -squads[i].size))

    best_assn: dict[int, int] = {}
    best_players, best_cost_total = -1, math.inf
    # Run in order of decreasing squad size to prioritise player count, then break ties by flexibility and cost.

    for order in (size_order, flex_order, cost_order):

        assn, load = _ffd_assign(order, squads, rooms, feasible, cost)
        _local_search(assn, load, squads, rooms, feasible, cost, max_iter)

        players = sum(squads[i].size for i in assn)
        cost_total = sum(cost[i][assn[i]] for i in assn)

        if players > best_players or (players == best_players and cost_total < best_cost_total):
            best_assn = assn
            best_players, best_cost_total = players, cost_total

    total_cost = 0.0
    for i, j in best_assn.items():
        total_cost += score(squads[i], rooms[j], w_dist, w_tier)

    return best_assn, total_cost