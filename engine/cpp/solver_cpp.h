#pragma once

#include <vector>
#include <map>
#include <utility>

#include "types.h"

// Public entry point — defined in solver_cpp.cpp, called from bindings.cpp.
// Returns (assignment, total_cost), assignment keyed by squad index.
std::pair<std::map<int, int>, double> solve_heuristic_cpp(
    const std::vector<Squad>& squads,
    const std::vector<Room>& rooms,
    double w_dist = 0.7,
    double w_tier = 0.3,
    int max_iter = 100);
