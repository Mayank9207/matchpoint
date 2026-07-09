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


static void ffd_assign(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const std::vector<int>& order,
    double w_dist,
    double w_tier,
    std::map<int,int>& assignment,
    std::vector<int>& room_load
) {

    //actually the order is given to us, the role of this function is to perform ffd as per that parameter
    for(auto& idx : order){
        const Squad& s = squads[idx];
        int best_room=-1;
        double best_score = std::numeric_limits<double> :: infinity();

        for(int r_idx=0;r_idx<rooms.size();r_idx++){
            const Room& r= rooms[r_idx];

            if(is_feasible(s,r) && room_load[r_idx]+s.size <= r.capacity){
                double s_score = score(s,r,w_dist,w_tier);
                if(s_score < best_score){
                    best_score = s_score;
                    best_room = r_idx;
                }
            }
        }
        if(best_room != -1){
            assignment[idx] = best_room;
            room_load[best_room] += s.size;
        }
        
    }
}


// 1 opt:try moving a single placed squad to a cheaper feasible room with headroom

static bool relocate_move(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    double w_dist,
    double w_tier,
    std::map<int,int>& assignment,
    std::vector<int>& room_load
) {
    //so we have to brute force 
    //we go over each placed squad, stored in form of assignment 
    bool relocated = false;

    for(const auto& [s_idx, r_idx] : assignment){
        const Squad& s = squads[s_idx];
        const Room& current_room = rooms[r_idx];
        double current_score = score(s,current_room,w_dist,w_tier);

        for(int new_r_idx=0; new_r_idx<rooms.size(); new_r_idx++){
            if(new_r_idx == r_idx)continue;

            const Room& new_room = rooms[new_r_idx];
            if(is_feasible(s,new_room) && room_load[new_r_idx]+s.size <= new_room.capacity){
                double new_score = score(s,new_room,w_dist,w_tier);

                if(new_score < current_score){
                   
                    assignment[s_idx] = new_r_idx;
                    room_load[r_idx] -= s.size;
                    room_load[new_r_idx] += s.size;
                    relocated = true;
                    
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
    double w_dist,
    double w_tier,
    std::map<int,int>& assignment,
    std::vector<int>& room_load
) {
    //we brute force over all pairs of placed squads and check if swapping them is beneficial
    bool swapped = false;

    for(auto it1 = assignment.begin();it1 != assignment.end(); ++it1){
        for(auto it2 = std::next(it1); it2 != assignment.end(); ++it2){
            int s1_idx = it1->first;
            int r1_idx = it1->second;
            int s2_idx = it2->first;
            int r2_idx = it2->second;

            const Squad& s1 = squads[s1_idx];
            const Squad& s2 = squads[s2_idx];
            const Room& r1 = rooms[r1_idx];
            const Room& r2 = rooms[r2_idx];

            if(!is_feasible(s1,r2) || !is_feasible(s2,r1))continue;
            //also check headroom
            if(room_load[r1_idx] - s1.size + s2.size > r1.capacity)continue;
            if(room_load[r2_idx] - s2.size + s1.size > r2.capacity)continue;

            double current_score = score(s1,r1,w_dist,w_tier) + score(s2,r2,w_dist,w_tier);
            double new_score = score(s1,r2,w_dist,w_tier) + score(s2,r1,w_dist,w_tier);

            if(new_score < current_score){
                //perform swap
                assignment[s1_idx] = r2_idx;
                assignment[s2_idx] = r1_idx;

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
    double w_dist,
    double w_tier,
    std::map<int,int>& assignment,
    std::vector<int>& room_load
){

    bool ejected = false; 

   std::vector<int> unplaced;
   
    for (int i = 0; i < squads.size(); i++) {
        if(assignment.find(i) == assignment.end())unplaced.push_back(i);
    }

    std::stable_sort(unplaced.begin(), unplaced.end(),[&](int a, int b) { return squads[a].size > squads[b].size; }); 


    for(int u_idx=0; u_idx<unplaced.size(); u_idx++){

        const Squad& s = squads[unplaced[u_idx]];
        int best_room = -1;
        double best_score = std::numeric_limits<double> :: infinity();

        //subphase A: try to directly place u
        for(int r_idx=0; r_idx<rooms.size(); r_idx++){
            const Room& r = rooms[r_idx];
            if(is_feasible(s,r) && room_load[r_idx] + s.size <= r.capacity){
                double s_score = score(s,r,w_dist,w_tier);
                if(s_score < best_score){
                    best_score = s_score;
                    best_room = r_idx;
                }
            }
        }

        if(best_room != -1){
            //place u in best_room
            assignment[unplaced[u_idx]] = best_room;
            room_load[best_room] += s.size;
            ejected = true;
            continue; 
        }

        //subphase B: try to evict a placed squad and relocate it
        std::optional<std::tuple<double,int,int,int>> best_move; //delta, p, room_u, room_p

        for(int j=0; j<rooms.size(); j++){
            const Room& r = rooms[j];
            if(!is_feasible(s,r))continue;

            int needed = room_load[j] + s.size - r.capacity;
            if(needed <= 0)continue; 

            //find candidates for eviction
            for(const auto& [p_idx, p_room] : assignment){
                if(p_room != j)continue;
                const Squad& p = squads[p_idx];
                if(p.size < needed)continue;

                //try to relocate p to another room k
                for(int k=0; k<rooms.size(); k++){
                    if(k == j)continue;
                    const Room& r_k = rooms[k];
                    if(!is_feasible(p,r_k))continue;
                    if(room_load[k] + p.size > r_k.capacity)continue;

                    double delta = score(s,r,w_dist,w_tier) + score(p,r_k,w_dist,w_tier) - score(p,r,w_dist,w_tier);
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
            assignment[unplaced[u_idx]] = room_u;
            assignment[p_idx] = room_p;

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
    double w_dist,
    double w_tier,
    std::map<int,int>& assignment,
    std::vector<int>& room_load
) {
    bool substituted = false;

    std::vector<int> unplaced;
    for (int i = 0; i < squads.size(); i++) {
        if(!assignment.count(i))unplaced.push_back(i);
    }
        //we sort unplaced in descending order of size to try bigger squads first, which is a tie-break Python also uses (and which the oracle uses as its final tie-break)
        auto comp = [&](int a, int b) { return squads[a].size > squads[b].size; };
        std::stable_sort(unplaced.begin(), unplaced.end(), comp);

        //now we brute force over all pairs of unplaced and placed squads and check if substituting is beneficial and feasible
        for(int u_idx=0; u_idx<unplaced.size(); u_idx++){
            const Squad& u = squads[unplaced[u_idx]];

            std::vector<std::pair<int,int>> placed_pairs(assignment.begin(), assignment.end());
            std::optional<std::tuple<double, int, int>> best_sub;

            for(const auto& [p_idx, r_idx] : placed_pairs){
                const Squad& p = squads[p_idx];
                const Room& r = rooms[r_idx];

                if(u.size < p.size)continue; 
                if(!is_feasible(u,r))continue; 

                double delta = score(p,r,w_dist,w_tier) - score(u,r,w_dist,w_tier);

                if (delta > 0) {
                    if (!best_sub.has_value() || delta > std::get<0>(best_sub.value())) {
                        best_sub = std::make_tuple(delta, p_idx, r_idx);
                    }
                }
            }
            if(best_sub.has_value()){
                auto [delta, p_idx, r_idx] = best_sub.value();

                assignment.erase(p_idx);
                assignment[unplaced[u_idx]] = r_idx;

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
    double w_dist,
    double w_tier,
    int max_iter,
    std::map<int,int>& assignment,
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


// Compute total assignment cost. Walk assignment in key order 
static double total_cost(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    const std::map<int,int>& assignment,
    double w_dist,
    double w_tier
) {
    double cost = 0.0;
    for(const auto& [s_idx, r_idx] : assignment){
        const Squad& s = squads[s_idx];
        const Room& r = rooms[r_idx];
        cost += score(s,r,w_dist,w_tier);
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

    std::vector<int> order_size = base_indices;

    std::stable_sort(order_size.begin(), order_size.end(), [&](int a, int b) {
        return squads[a].size > squads[b].size;
    });

    std::vector<int> flex_counts(squads.size(), 0);
    for (int i = 0; i < squads.size(); ++i) {
        for (const auto& r : rooms) {
            if (is_feasible(squads[i], r)) flex_counts[i]++;
        }
    }
    std::vector<int> order_flex = base_indices;

    std::stable_sort(order_flex.begin(), order_flex.end(), [&](int a, int b) {
        return flex_counts[a] < flex_counts[b];
    });

    std::vector<double> min_costs(squads.size(), std::numeric_limits<double>::infinity());
    for (int i = 0; i < squads.size(); ++i) {
        for (const auto& r : rooms) {
            if (is_feasible(squads[i], r)) {
                double c = score(squads[i], r, w_dist, w_tier);
                if (c < min_costs[i]) min_costs[i] = c;
            }
        }
    }

    std::vector<int> order_cost = base_indices;
    std::stable_sort(order_cost.begin(), order_cost.end(), [&](int a, int b) {
        return min_costs[a] < min_costs[b];
    });

    //we have laid out the orderings now we place them in a 2d vector and run the whole flow over each of them
    
    std::vector<std::vector<int>> orderings = {order_size, order_flex, order_cost};
    
    std::map<int, int> best_assignment;
    int best_placed_players = -1;
    double best_cost = std::numeric_limits<double>::infinity();

    for (const auto& order : orderings) {
        
        std::map<int, int> current_assignment;
        std::vector<int> current_load(rooms.size(), 0);

        ffd_assign(squads, rooms, order, w_dist, w_tier, current_assignment, current_load);
        

        local_search(squads, rooms, w_dist, w_tier, max_iter, current_assignment, current_load); 

        //we need to 

        int current_placed = 0;
        for (const auto& [s_idx, r_idx] : current_assignment) {
            current_placed += squads[s_idx].size;
        }
        double current_cost = total_cost(squads, rooms, current_assignment, w_dist, w_tier);


        if (current_placed > best_placed_players || 
           (current_placed == best_placed_players && current_cost < best_cost)) {
            
            best_placed_players = current_placed;
            best_cost = current_cost;
            best_assignment = current_assignment;
        }
    }

    return {best_assignment, best_cost};
}
