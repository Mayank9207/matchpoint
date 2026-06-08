#pragma once
#include "types.h"
#include <cmath>
#include <limits>
#include <cstdlib>

inline double haversine_m(const Squads& squads, int s_idx, const Rooms& rooms, int r_idx) {
    constexpr double EARTH_R = 6371000.0;  // metres
    // Mirror Python's utils.haversine_m bit-for-bit: convert each coordinate
    // to radians first (x * (pi/180)), then take differences of the radian
    // values — NOT radians(lat2 - lat1).  Matching the operation order keeps
    // the result byte-identical with CPython's math.radians.
    constexpr double DEG2RAD = M_PI / 180.0;

    double rlat1 = squads.lat[s_idx] * DEG2RAD;
    double rlon1 = squads.lon[s_idx] * DEG2RAD;
    double rlat2 = rooms.lat[r_idx] * DEG2RAD;
    double rlon2 = rooms.lon[r_idx] * DEG2RAD;

    double dlat = rlat2 - rlat1;
    double dlon = rlon2 - rlon1;

    double a = std::sin(dlat / 2.0) * std::sin(dlat / 2.0)
             + std::cos(rlat1) * std::cos(rlat2)
             * std::sin(dlon / 2.0) * std::sin(dlon / 2.0);

    return 2.0 * EARTH_R * std::asin(std::sqrt(a));
}

inline bool is_feasible(const Squads& squads, int s_idx, const Rooms& rooms, int r_idx) {

    if(squads.sport[s_idx] != rooms.sport[r_idx])return false;

    if(squads.size[s_idx] > rooms.capacity[r_idx])return false;

    if(rooms.match_time[r_idx] < squads.start_time[s_idx] || rooms.match_time[r_idx] > squads.end_time[s_idx])return false;

    if(haversine_m(squads,s_idx,rooms,r_idx) > squads.max_distance[s_idx])return false;

    return true;

}

inline double score(const Squads& squads, int s_idx, const Rooms& rooms, int r_idx, double w_dist, double w_tier) {


    if(!is_feasible(squads,s_idx,rooms,r_idx))return std::numeric_limits<double> :: infinity();

    else return w_dist * (haversine_m(squads,s_idx,rooms,r_idx)/squads.max_distance[s_idx]) + w_tier * (std::abs(squads.tier[s_idx] - rooms.desired_tier[r_idx])/2.0);
}
