#pragma once

#include <vector>
#include <cstddef>

// Struct-of-Arrays (SoA) layout.  Each field is a parallel array indexed by the
// squad/room index.  squads.lat[i] is the latitude of squad i, etc.  This
// replaces the previous Array-of-Structs (std::vector<Squad>) layout — the data
// is identical, only the memory layout changed.

struct Squads {
    std::vector<int> size;
    std::vector<int> sport;
    std::vector<int> tier;
    std::vector<double> lat;
    std::vector<double> lon;
    std::vector<double> max_distance;
    std::vector<double> start_time;
    std::vector<double> end_time;

    std::size_t size_() const { return sport.size(); }
};

struct Rooms {
    std::vector<int> capacity;
    std::vector<int> sport;
    std::vector<int> desired_tier;
    std::vector<double> lat;
    std::vector<double> lon;
    std::vector<double> match_time;

    std::size_t size_() const { return sport.size(); }
};
