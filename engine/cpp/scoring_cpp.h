#pragma once
#include "types.h"
#include <cmath>
#include <limits>
#include <cstdlib>

inline double haversine_m(const Squad& s, const Room& r) {
    constexpr double EARTH_R = 6371000.0;  // metres
    // Mirror Python's utils.haversine_m bit-for-bit: convert each coordinate
    // to radians first (x * (pi/180)), then take differences of the radian
    // values — NOT radians(lat2 - lat1).  Matching the operation order keeps
    // the result byte-identical with CPython's math.radians.
    constexpr double DEG2RAD = M_PI / 180.0;

    double rlat1 = s.lat * DEG2RAD;
    double rlon1 = s.lon * DEG2RAD;
    double rlat2 = r.lat * DEG2RAD;
    double rlon2 = r.lon * DEG2RAD;

    double dlat = rlat2 - rlat1;
    double dlon = rlon2 - rlon1;

    double a = std::sin(dlat / 2.0) * std::sin(dlat / 2.0)
             + std::cos(rlat1) * std::cos(rlat2)
             * std::sin(dlon / 2.0) * std::sin(dlon / 2.0);

    return 2.0 * EARTH_R * std::asin(std::sqrt(a));
}

inline bool is_feasible(const Squad& s, const Room& r) {

    if(s.sport != r.sport)return false;

    if(s.size > r.capacity)return false;

    if(r.match_time < s.start_time || r.match_time > s.end_time)return false;

    if(haversine_m(s,r) > s.max_distance)return false;

    return true;

}

inline double score(const Squad& s, const Room& r, double w_dist, double w_tier) {


    if(!is_feasible(s,r))return std::numeric_limits<double> :: infinity();

    else return w_dist * (haversine_m(s,r)/s.max_distance) + w_tier * (std::abs(s.tier - r.desired_tier)/2.0);
}