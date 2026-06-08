#pragma once  


struct Squad{
    int id;
    int size;
    int sport;
    int tier;
    double lat;
    double lon;
    double max_distance;
    double start_time;
    double end_time;
};

struct Room{
    int id;
    int capacity;
    int sport;
    int desired_tier;
    double lat;
    double lon;
    double match_time;
};