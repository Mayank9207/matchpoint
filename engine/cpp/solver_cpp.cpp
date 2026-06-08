#include "solver_cpp.h"
#include "scoring_cpp.h"
#include "types.h"
#include "ordered_assign.h"

#include <vector>
#include <map>
#include <utility>
#include <algorithm>
#include <limits>
#include <numeric>
#include <optional>
#include <tuple>


static void ffd_assign(
    const Squads& squads,
    const Rooms& rooms,
    const std::vector<int>& order,
    double w_dist,
    double w_tier,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {

    //actually the order is given to us, the role of this function is to perform ffd as per that parameter
    for(auto& idx : order){
        int best_room=-1;
        double best_score = std::numeric_limits<double> :: infinity();

        for(int r_idx=0;r_idx<rooms.size_();r_idx++){

            if(room_load[r_idx]+squads.size[idx] <= rooms.capacity[r_idx] && is_feasible(squads,idx,rooms,r_idx)){
                double s_score = score(squads,idx,rooms,r_idx,w_dist,w_tier);
                if(s_score < best_score){
                    best_score = s_score;
                    best_room = r_idx;
                }
            }
        }
        if(best_room != -1){
            assignment.set(idx, best_room);
            room_load[best_room] += squads.size[idx];
        }

    }
}


// 1 opt:try moving a single placed squad to a cheaper feasible room with headroom

static bool relocate_move(
    const Squads& squads,
    const Rooms& rooms,
    double w_dist,
    double w_tier,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    //so we have to brute force
    //we go over each placed squad, stored in form of assignment
    bool relocated = false;

    for(int s_idx : assignment.order){
        int r_idx = assignment.at(s_idx);
        double current_score = score(squads,s_idx,rooms,r_idx,w_dist,w_tier);

        for(int new_r_idx=0; new_r_idx<rooms.size_(); new_r_idx++){
            if(new_r_idx == r_idx)continue;

            if(room_load[new_r_idx]+squads.size[s_idx] <= rooms.capacity[new_r_idx] && is_feasible(squads,s_idx,rooms,new_r_idx)){
                double new_score = score(squads,s_idx,rooms,new_r_idx,w_dist,w_tier);

                if(new_score < current_score){

                    assignment.set(s_idx, new_r_idx);
                    room_load[r_idx] -= squads.size[s_idx];
                    room_load[new_r_idx] += squads.size[s_idx];
                    r_idx = new_r_idx;                                  // re-baseline current room
                    current_score = score(squads,s_idx,rooms,new_r_idx,w_dist,w_tier);   // re-baseline current cost
                    relocated = true;

                }
            }
        }
    }
    return relocated;
}


// 2 opt: swap two placed squads rooms if both fit and total cost drops

static bool swap_move(
    const Squads& squads,
    const Rooms& rooms,
    double w_dist,
    double w_tier,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    //we brute force over all pairs of placed squads and check if swapping them is beneficial
    bool swapped = false;

    for(size_t i1 = 0; i1 < assignment.order.size(); ++i1){
        for(size_t i2 = i1 + 1; i2 < assignment.order.size(); ++i2){
            int s1_idx = assignment.order[i1];
            int r1_idx = assignment.at(s1_idx);
            int s2_idx = assignment.order[i2];
            int r2_idx = assignment.at(s2_idx);

            if(!is_feasible(squads,s1_idx,rooms,r2_idx) || !is_feasible(squads,s2_idx,rooms,r1_idx))continue;
            //also check headroom
            if(room_load[r1_idx] - squads.size[s1_idx] + squads.size[s2_idx] > rooms.capacity[r1_idx])continue;
            if(room_load[r2_idx] - squads.size[s2_idx] + squads.size[s1_idx] > rooms.capacity[r2_idx])continue;

            double current_score = score(squads,s1_idx,rooms,r1_idx,w_dist,w_tier) + score(squads,s2_idx,rooms,r2_idx,w_dist,w_tier);
            double new_score = score(squads,s1_idx,rooms,r2_idx,w_dist,w_tier) + score(squads,s2_idx,rooms,r1_idx,w_dist,w_tier);

            if(new_score < current_score){
                //perform swap
                assignment.set(s1_idx, r2_idx);
                assignment.set(s2_idx, r1_idx);

                room_load[r1_idx] = room_load[r1_idx] - squads.size[s1_idx] + squads.size[s2_idx];
                room_load[r2_idx] = room_load[r2_idx] - squads.size[s2_idx] + squads.size[s1_idx];

                swapped = true;
            }


        }
    }

    return swapped;
}


// Ejection chain (single-step): evict a placed squad P from room R so that an
// unplaced squad U can take R; relocate P to another feasible room with headroom.
// Accept if the chain nets more players matched (player count beats cost — matches
// the oracle's lex priority).
static bool ejection_chain_move(
    const Squads& squads,
    const Rooms& rooms,
    double w_dist,
    double w_tier,
    OrderedAssign& assignment,
    std::vector<int>& room_load
){

    bool ejected = false;

   std::vector<int> unplaced;

    for (int i = 0; i < squads.size_(); i++) {
        if(!assignment.contains(i))unplaced.push_back(i);
    }

    std::stable_sort(unplaced.begin(), unplaced.end(),[&](int a, int b) { return squads.size[a] > squads.size[b]; });
    //fix brackets please

    for(int u_idx=0; u_idx<unplaced.size(); u_idx++){

        int s_idx = unplaced[u_idx];
        int best_room = -1;
        double best_score = std::numeric_limits<double> :: infinity();

        //subphase A: try to directly place u
        for(int r_idx=0; r_idx<rooms.size_(); r_idx++){
            if(is_feasible(squads,s_idx,rooms,r_idx) && room_load[r_idx] + squads.size[s_idx] <= rooms.capacity[r_idx]){
                double s_score = score(squads,s_idx,rooms,r_idx,w_dist,w_tier);
                if(s_score < best_score){
                    best_score = s_score;
                    best_room = r_idx;
                }
            }
        }

        if(best_room != -1){
            //place u in best_room
            assignment.set(unplaced[u_idx], best_room);
            room_load[best_room] += squads.size[s_idx];
            ejected = true;
            continue;
        }

        //subphase B: try to evict a placed squad and relocate it
        std::optional<std::tuple<double,int,int,int>> best_move; //delta, p, room_u, room_p

        for(int j=0; j<rooms.size_(); j++){
            if(!is_feasible(squads,s_idx,rooms,j))continue;

            int needed = room_load[j] + squads.size[s_idx] - rooms.capacity[j];
            if(needed <= 0)continue; //would have been caught by subphase A

            //find candidates for eviction
            for(int p_idx : assignment.order){
                int p_room = assignment.at(p_idx);
                if(p_room != j)continue;
                if(squads.size[p_idx] < needed)continue;

                //try to relocate p to another room k
                for(int k=0; k<rooms.size_(); k++){
                    if(k == j)continue;
                    if(!is_feasible(squads,p_idx,rooms,k))continue;
                    if(room_load[k] + squads.size[p_idx] > rooms.capacity[k])continue;

                    double delta = score(squads,s_idx,rooms,j,w_dist,w_tier) + score(squads,p_idx,rooms,k,w_dist,w_tier) - score(squads,p_idx,rooms,j,w_dist,w_tier);
                    if(!best_move.has_value() || delta < std::get<0>(best_move.value())){
                        best_move = std::make_tuple(delta, p_idx, j, k);
                    }
                }
            }
        }
        if(best_move.has_value()){
            auto [delta, p_idx, room_u, room_p] = best_move.value();

            //apply move: place u in room_u, relocate p to room_p
            assignment.set(unplaced[u_idx], room_u);
            assignment.set(p_idx, room_p);

            room_load[room_u] -= squads.size[p_idx];
            room_load[room_u] += squads.size[s_idx];
            room_load[room_p] += squads.size[p_idx]; //p leaves room_u and goes to room_p

            ejected = true;
        }


         //return true if we ejected someone (even if we found no move, we return false, which is correct for the convergence check)

    }
    return ejected;
}


// Substitution: replace placed squad P with unplaced squad U, where
// score(U) < score(P) AND size(U) >= size(P). The size guard is a CORRECTNESS
// INVARIANT — removing it drops player count on undersupplied instances.
static bool substitution_move(
    const Squads& squads,
    const Rooms& rooms,
    double w_dist,
    double w_tier,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    bool substituted = false;

    std::vector<int> unplaced;
    for (int i = 0; i < squads.size_(); i++) {
        if(!assignment.contains(i))unplaced.push_back(i);
    }
        //Python walks unplaced in ascending index order here (no size sort)

        //now we brute force over all pairs of unplaced and placed squads and check if substituting is beneficial and feasible
        for(int u_idx=0; u_idx<unplaced.size(); u_idx++){
            int u = unplaced[u_idx];

            std::vector<std::pair<int,int>> placed_pairs;
            for(int p_idx : assignment.order)placed_pairs.push_back({p_idx, assignment.at(p_idx)});
            std::optional<std::tuple<double, int, int>> best_sub;

            for(const auto& [p_idx, r_idx] : placed_pairs){

                if(squads.size[u] < squads.size[p_idx])continue; //size guard
                if(!is_feasible(squads,u,rooms,r_idx))continue; //feasibility guard
                if(room_load[r_idx] - squads.size[p_idx] + squads.size[u] > rooms.capacity[r_idx])continue; //capacity guard

                double delta = score(squads,p_idx,rooms,r_idx,w_dist,w_tier) - score(squads,u,rooms,r_idx,w_dist,w_tier);

                if (delta > 0) {
                    if (!best_sub.has_value() || delta > std::get<0>(best_sub.value())) {
                        best_sub = std::make_tuple(delta, p_idx, r_idx);
                    }
                }
            }
            if(best_sub.has_value()){
                auto [delta, p_idx, r_idx] = best_sub.value();

                assignment.erase(p_idx);
                assignment.set(unplaced[u_idx], r_idx);

                room_load[r_idx] -= squads.size[p_idx];
                room_load[r_idx] += squads.size[u];

                substituted = true;
            }
        }


    return substituted;
}


// Run all four move types in a fixed order until no move improves the solution.
// Terminates because each move strictly improves a bounded objective.
static void local_search(
    const Squads& squads,
    const Rooms& rooms,
    double w_dist,
    double w_tier,
    int max_iter,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    for(int iter=0; iter<max_iter; iter++){

        bool improved = false;

        if(relocate_move(squads, rooms, w_dist, w_tier, assignment, room_load))improved = true;

        if(swap_move(squads, rooms, w_dist, w_tier, assignment, room_load))improved = true;

        if(ejection_chain_move(squads, rooms, w_dist, w_tier, assignment, room_load))improved = true;

        if(substitution_move(squads, rooms, w_dist, w_tier, assignment, room_load))improved = true;


        if(!improved)break;
    }
}


// Compute total assignment cost. Walk assignment in insertion order (matching
// the Python dict the heuristic mirrors).
static double total_cost(
    const Squads& squads,
    const Rooms& rooms,
    const OrderedAssign& assignment,
    double w_dist,
    double w_tier
) {
    double cost = 0.0;
    for(int s_idx : assignment.order){
        int r_idx = assignment.at(s_idx);
        cost += score(squads,s_idx,rooms,r_idx,w_dist,w_tier);
    }


    return cost;
}


// ============================================================
//  Public entry point — called from bindings.cpp
// ============================================================

std::pair<std::map<int,int>, double> solve_heuristic_cpp(
    const Squads& squads,
    const Rooms& rooms,
    double w_dist,
    double w_tier,
    int max_iter
) {

    std::vector<int> base_indices(squads.size_());
    std::iota(base_indices.begin(), base_indices.end(), 0);

    std::vector<int> order_size = base_indices;

    std::stable_sort(order_size.begin(), order_size.end(), [&](int a, int b) {
        return squads.size[a] > squads.size[b];
    });

    std::vector<int> flex_counts(squads.size_(), 0);
    for (int i = 0; i < squads.size_(); ++i) {
        for (int j = 0; j < rooms.size_(); ++j) {
            if (is_feasible(squads, i, rooms, j)) flex_counts[i]++;
        }
    }
    std::vector<int> order_flex = base_indices;

    std::stable_sort(order_flex.begin(), order_flex.end(), [&](int a, int b) {
        if (flex_counts[a] != flex_counts[b]) return flex_counts[a] < flex_counts[b];
        return squads.size[a] > squads.size[b];   // Python tiebreak: -size
    });

    std::vector<double> min_costs(squads.size_(), std::numeric_limits<double>::infinity());
    for (int i = 0; i < squads.size_(); ++i) {
        for (int j = 0; j < rooms.size_(); ++j) {
            if (is_feasible(squads, i, rooms, j)) {
                double c = score(squads, i, rooms, j, w_dist, w_tier);
                if (c < min_costs[i]) min_costs[i] = c;
            }
        }
    }

    std::vector<int> order_cost = base_indices;
    std::stable_sort(order_cost.begin(), order_cost.end(), [&](int a, int b) {
        if (min_costs[a] != min_costs[b]) return min_costs[a] < min_costs[b];
        return squads.size[a] > squads.size[b];   // Python tiebreak: -size
    });

    //we have laid out the orderings now we place them in a 2d vector and run the whole flow over each of them

    std::vector<std::vector<int>> orderings = {order_size, order_flex, order_cost};

    OrderedAssign best_assignment(squads.size_());
    int best_placed_players = -1;
    double best_cost = std::numeric_limits<double>::infinity();

    for (const auto& order : orderings) {

        OrderedAssign current_assignment(squads.size_());
        std::vector<int> current_load(rooms.size_(), 0);

        ffd_assign(squads, rooms, order, w_dist, w_tier, current_assignment, current_load);


        local_search(squads, rooms, w_dist, w_tier, max_iter, current_assignment, current_load);

        //we need to

        int current_placed = 0;
        for (int s_idx : current_assignment.order) {
            current_placed += squads.size[s_idx];
        }
        double current_cost = total_cost(squads, rooms, current_assignment, w_dist, w_tier);


        if (current_placed > best_placed_players ||
           (current_placed == best_placed_players && current_cost < best_cost)) {

            best_placed_players = current_placed;
            best_cost = current_cost;
            best_assignment = current_assignment;
        }
    }

    // Build the std::map from OrderedAssign only at the boundary, where the
    // ordering no longer matters.
    std::map<int,int> result;
    for (int s_idx : best_assignment.order) {
        result[s_idx] = best_assignment.at(s_idx);
    }

    return {result, best_cost};
}
