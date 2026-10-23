#include "solver_cpp.h"
#include "scoring_cpp.h"
#include "types.h"

#include <vector>
#include <map>
#include <utility>
#include <algorithm>
#include <limits>
#include <optional>
#include <numeric>
#include <tuple>

#include "ordered_assign.h"


struct Tables {
    int R;
    std::vector<char> feasible;
    std::vector<double> cost;
};


static void ffd_assign(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const std::vector<int>& order,
    const Tables& tables,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {

    //actually the order is given to us, the role of this function is to perform ffd as per that parameter
    for(auto& idx : order){
        const Squad& s = squads[idx];
        int best_room=-1;
        double best_score = std::numeric_limits<double> :: infinity();

        for(int r_idx=0;r_idx<rooms.size();r_idx++){
            const Room& r= rooms[r_idx];

            if(tables.feasible[idx * tables.R + r_idx] && room_load[r_idx]+s.size <= r.capacity){
                double s_score = tables.cost[idx * tables.R + r_idx];
                if(s_score < best_score){
                    best_score = s_score;
                    best_room = r_idx;
                }
            }
        }
        if(best_room != -1){
            assignment.set(idx, best_room);
            room_load[best_room] += s.size;
        }
        
    }
}


// 1 opt:try moving a single placed squad to a cheaper feasible room with headroom

static bool relocate_move(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const Tables& tables,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    //so we have to brute force 
    //we go over each placed squad, stored in form of assignment
    //Bug fix: The bindings here, [s_idx, r_idx] are actually not independent copies but reference to the map pairs 
    //So any change we are making acutlly has effect on the future so we can't just keep updating it like that so we need independent state 
    //variables and correct updation order 

    bool relocated = false;

    for (int s_idx : assignment.order) {
        int r_idx = assignment.at(s_idx);
        int current_r_idx = r_idx;
      
        const Squad& s = squads[s_idx];
        double current_score = tables.cost[s_idx * tables.R + r_idx];

        for(int new_r_idx=0; new_r_idx<rooms.size(); new_r_idx++){
            if(new_r_idx == current_r_idx)continue;

            const Room& new_room = rooms[new_r_idx];
            if(tables.feasible[s_idx * tables.R + new_r_idx] && room_load[new_r_idx]+s.size <= new_room.capacity){
                double new_score = tables.cost[s_idx * tables.R + new_r_idx];

                if(new_score < current_score){


                   
                    assignment.set(s_idx, new_r_idx);
                    room_load[current_r_idx] -= s.size;
                    room_load[new_r_idx] += s.size;

                    current_r_idx = new_r_idx;
                    relocated = true;

                    current_score = new_score;
                    
                }
            }
        }
    }
    return relocated;
}


// 2 opt: swap two placed squads rooms if both fit and total cost drops

static bool swap_move(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const Tables& tables,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    //we brute force over all pairs of placed squads and check if swapping them is beneficial
    bool swapped = false;

    for (size_t i1 = 0; i1 < assignment.order.size(); ++i1) {
        for (size_t i2 = i1 + 1; i2 < assignment.order.size(); ++i2) {
            int s1_idx = assignment.order[i1];
            int r1_idx = assignment.at(s1_idx);
            int s2_idx = assignment.order[i2];
            int r2_idx = assignment.at(s2_idx);

            const Squad& s1 = squads[s1_idx];
            const Squad& s2 = squads[s2_idx];
            const Room& r1 = rooms[r1_idx];
            const Room& r2 = rooms[r2_idx];

            if(!tables.feasible[s1_idx * tables.R + r2_idx] || !tables.feasible[s2_idx * tables.R + r1_idx])continue;
            //also check headroom
            if(room_load[r1_idx] - s1.size + s2.size > r1.capacity)continue;
            if(room_load[r2_idx] - s2.size + s1.size > r2.capacity)continue;

            double current_score = tables.cost[s1_idx * tables.R + r1_idx] + tables.cost[s2_idx * tables.R + r2_idx];
            double new_score = tables.cost[s1_idx * tables.R + r2_idx] + tables.cost[s2_idx * tables.R + r1_idx];

            if(new_score < current_score){
                //perform swap
                assignment.set(s1_idx, r2_idx);
                assignment.set(s2_idx, r1_idx);

                room_load[r1_idx] = room_load[r1_idx] - s1.size + s2.size;
                room_load[r2_idx] = room_load[r2_idx] - s2.size + s1.size;

                swapped = true;
            }


        }
    }

    return swapped;
}


// Ejection chain: it is single step, evict a placed squad P from room R so that an
// unplaced squad U can take R; relocate P to another feasible room with headroom.

static bool ejection_chain_move(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const Tables& tables,
    OrderedAssign& assignment,
    std::vector<int>& room_load
){

    bool ejected = false; 

   std::vector<int> unplaced;
   
    for (int i = 0; i < squads.size(); i++) {
        if(!assignment.contains(i))unplaced.push_back(i);
    }

    std::stable_sort(unplaced.begin(), unplaced.end(),[&](int a, int b) { return squads[a].size > squads[b].size; }); 


    for(int u_idx=0; u_idx<unplaced.size(); u_idx++){

        const Squad& s = squads[unplaced[u_idx]];
        int best_room = -1;
        double best_score = std::numeric_limits<double> :: infinity();

        //subphase A: try to directly place u
        for(int r_idx=0; r_idx<rooms.size(); r_idx++){
            const Room& r = rooms[r_idx];
            if(tables.feasible[unplaced[u_idx] * tables.R + r_idx] && room_load[r_idx] + s.size <= r.capacity){
                double s_score = tables.cost[unplaced[u_idx] * tables.R + r_idx];
                if(s_score < best_score){
                    best_score = s_score;
                    best_room = r_idx;
                }
            }
        }

        if(best_room != -1){
            //place u in best_room
            assignment.set(unplaced[u_idx], best_room);
            room_load[best_room] += s.size;
            ejected = true;
            continue; 
        }

        //subphase B: try to evict a placed squad and relocate it
        std::optional<std::tuple<double,int,int,int>> best_move; //delta, p, room_u, room_p

        for(int j=0; j<rooms.size(); j++){
            const Room& r = rooms[j];
            if(!tables.feasible[unplaced[u_idx] * tables.R + j])continue;

            int needed = room_load[j] + s.size - r.capacity;
            if(needed <= 0)continue; 

            //find candidates for eviction
            for (int p_idx : assignment.order) {
                int p_room = assignment.at(p_idx);
                if(p_room != j)continue;
                const Squad& p = squads[p_idx];
                if(p.size < needed)continue;

                //try to relocate p to another room k
                for(int k=0; k<rooms.size(); k++){
                    if(k == j)continue;
                    const Room& r_k = rooms[k];
                    if(!tables.feasible[p_idx * tables.R + k])continue;
                    if(room_load[k] + p.size > r_k.capacity)continue;

                    double delta = tables.cost[unplaced[u_idx] * tables.R + j] + tables.cost[p_idx * tables.R + k] - tables.cost[p_idx * tables.R + j];
                    if(!best_move.has_value() || delta < std::get<0>(best_move.value())){
                        best_move = std::make_tuple(delta, p_idx, j, k);
                    }
                }
            }
        }
        if(best_move.has_value()){
            auto [delta, p_idx, room_u, room_p] = best_move.value();
            const Squad& p = squads[p_idx];

            //apply move: place u in room_u, relocate p to room_p
            assignment.set(unplaced[u_idx], room_u);
            assignment.set(p_idx, room_p);

            room_load[room_u] -= p.size;
            room_load[room_u] += s.size;
            room_load[room_p] += p.size; //p leaves room_u and goes to room_p

            ejected = true;
        }
    

         //return true if we ejected someone (even if we found no move, we return false, which is correct for the convergence check)

    }
    return ejected;
}


// Substitution: replace placed squad P with unplaced squad U
static bool substitution_move(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const Tables& tables,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    bool substituted = false;

    std::vector<int> unplaced;
    for (int i = 0; i < squads.size(); i++) {
        if(!assignment.contains(i))unplaced.push_back(i);
    }

        //now we brute force over all pairs of unplaced and placed squads and check if substituting is beneficial and feasible
        for(int u_idx=0; u_idx<unplaced.size(); u_idx++){
            const Squad& u = squads[unplaced[u_idx]];

            std::vector<std::pair<int,int>> placed_pairs;
            for (int p_idx : assignment.order) {
                placed_pairs.push_back({p_idx, assignment.at(p_idx)});
            }
            std::optional<std::tuple<double, int, int>> best_sub;

            for(const auto& [p_idx, r_idx] : placed_pairs){
                const Squad& p = squads[p_idx];
                const Room& r = rooms[r_idx];

                if(u.size < p.size)continue; 
                if(!tables.feasible[unplaced[u_idx] * tables.R + r_idx])continue;

                long long new_load =
                static_cast<long long>(room_load[r_idx]) - p.size + u.size;

                if (new_load > r.capacity) continue;

                double delta = tables.cost[p_idx * tables.R + r_idx] - tables.cost[unplaced[u_idx] * tables.R + r_idx];

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

                room_load[r_idx] -= squads[p_idx].size;
                room_load[r_idx] += u.size;

                substituted = true;
            }
        }

    
    return substituted;
}


// Run all four move types in a fixed order until no move improves score
static void local_search(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const Tables& tables,
    int max_iter,
    OrderedAssign& assignment,
    std::vector<int>& room_load
) {
    for(int iter=0; iter<max_iter; iter++){
        
        bool improved = false;

        if(relocate_move(squads, rooms, tables, assignment, room_load))improved = true;
        
        if(swap_move(squads, rooms, tables, assignment, room_load))improved = true;
        
        if(ejection_chain_move(squads, rooms, tables, assignment, room_load))improved = true;
        
        if(substitution_move(squads, rooms, tables, assignment, room_load))improved = true;
        

        if(!improved)break; 
    }
}


// Compute total assignment cost. Walk assignment in insertion order 
static double total_cost(
    const Tables& tables,
    const OrderedAssign& assignment
) {
    double cost = 0.0;
    for (int s_idx : assignment.order) {
        int r_idx = assignment.at(s_idx);
        cost += tables.cost[s_idx * tables.R + r_idx];
    }


    return cost;
}



std::pair<std::map<int,int>, double> solve_heuristic_cpp(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    double w_dist,
    double w_tier,
    int max_iter
) {
   
    std::vector<int> base_indices(squads.size());
    std::iota(base_indices.begin(), base_indices.end(), 0);

    const int S = static_cast<int>(squads.size());
    const int R = static_cast<int>(rooms.size());

    Tables tables{
        R,
        std::vector<char>(S * R, 0),
        std::vector<double>(S * R, std::numeric_limits<double>::infinity())
    };

    for (int i = 0; i < S; ++i) {
        for (int j = 0; j < R; ++j) {
            if (is_feasible(squads[i], rooms[j])) {
                tables.feasible[i * R + j] = 1;
                tables.cost[i * R + j] = score(squads[i], rooms[j], w_dist, w_tier);
            }
        }
    }

    std::vector<int> order_size = base_indices;

    std::stable_sort(order_size.begin(), order_size.end(), [&](int a, int b) {
        return squads[a].size > squads[b].size;
    });

    std::vector<int> flex_counts(S, 0);
    std::vector<double> min_costs(S, std::numeric_limits<double>::infinity());
    for (int i = 0; i < S; ++i) {
        for (int j = 0; j < R; ++j) {
            if (!tables.feasible[i * R + j]) continue;
            flex_counts[i]++;
            min_costs[i] = std::min(min_costs[i], tables.cost[i * R + j]);
        }
    }
    std::vector<int> order_flex = base_indices;

    std::stable_sort(order_flex.begin(), order_flex.end(), [&](int a, int b) {
        if(flex_counts[a] != flex_counts[b])return flex_counts[a] < flex_counts[b];
        return squads[a].size > squads[b].size;
    });

    std::vector<int> order_cost = base_indices;
    std::stable_sort(order_cost.begin(), order_cost.end(), [&](int a, int b) {
        
        if(min_costs[a] != min_costs[b])return min_costs[a] < min_costs[b];
        
        return squads[a].size > squads[b].size;
    });

    //we have laid out the orderings now we place them in a 2d vector and run the whole flow over each of them
    
    std::vector<std::vector<int>> orderings = {order_size, order_flex, order_cost};
    
    OrderedAssign best_assignment(squads.size());
    int best_placed_players = -1;
    double best_cost = std::numeric_limits<double>::infinity();

    for (const auto& order : orderings) {
        
        OrderedAssign current_assignment(squads.size());
        std::vector<int> current_load(rooms.size(), 0);

        ffd_assign(squads, rooms, order, tables, current_assignment, current_load);
        

        local_search(squads, rooms, tables, max_iter, current_assignment, current_load); 

        //we need to 

        int current_placed = 0;
        for (int s_idx : current_assignment.order) {
            current_placed += squads[s_idx].size;
        }
        double current_cost = total_cost(tables, current_assignment);


        if (current_placed > best_placed_players || 
           (current_placed == best_placed_players && current_cost < best_cost)) {
            
            best_placed_players = current_placed;
            best_cost = current_cost;
            best_assignment = current_assignment;
        }
    }

    std::map<int, int> result;
    for (int s_idx : best_assignment.order) {
        result[s_idx] = best_assignment.at(s_idx);
    }
    return {result, best_cost};
}
