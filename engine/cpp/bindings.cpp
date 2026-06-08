#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <vector>
#include <map>
#include <utility>

#include "types.h"
#include "solver_cpp.h"

namespace py = pybind11;

static Squads squads_from_py(const py::list& py_squads){
    Squads squads;

    size_t n = py::len(py_squads);
    squads.size.reserve(n);
    squads.sport.reserve(n);
    squads.tier.reserve(n);
    squads.lat.reserve(n);
    squads.lon.reserve(n);
    squads.max_distance.reserve(n);
    squads.start_time.reserve(n);
    squads.end_time.reserve(n);

    for(const auto& obj:py_squads){

        squads.size.push_back(obj.attr("size").cast<int>());
        squads.sport.push_back(obj.attr("sport").cast<int>());
        squads.tier.push_back(obj.attr("tier").cast<int>());
        squads.lat.push_back(obj.attr("lat").cast<double>());
        squads.lon.push_back(obj.attr("lon").cast<double>());
        squads.max_distance.push_back(obj.attr("max_distance").cast<double>());
        squads.start_time.push_back(obj.attr("start_time").cast<double>());
        squads.end_time.push_back(obj.attr("end_time").cast<double>());
    }

    return squads;
}

static Rooms rooms_from_py(const py::list& py_rooms){
    Rooms rooms;

    size_t n = py::len(py_rooms);
    rooms.capacity.reserve(n);
    rooms.sport.reserve(n);
    rooms.desired_tier.reserve(n);
    rooms.lat.reserve(n);
    rooms.lon.reserve(n);
    rooms.match_time.reserve(n);

    for(const auto& obj:py_rooms){

        rooms.sport.push_back(obj.attr("sport").cast<int>());
        rooms.desired_tier.push_back(obj.attr("desired_tier").cast<int>());
        rooms.capacity.push_back(obj.attr("capacity").cast<int>());
        rooms.lat.push_back(obj.attr("lat").cast<double>());
        rooms.lon.push_back(obj.attr("lon").cast<double>());
        rooms.match_time.push_back(obj.attr("match_time").cast<double>());
    }

    return rooms;
}

static std::pair<std::map<int,int>,double> solve_heuristic_py(const py::list& py_squads, const py::list& py_rooms, double w_dist, double w_tier, int max_iter){

    Squads squads = squads_from_py(py_squads);
    Rooms rooms = rooms_from_py(py_rooms);


    std::pair<std::map<int,int>, double> result;
    

    {
        // we release GIL in the computational block for concurrency
    py::gil_scoped_release release;

    result = solve_heuristic_cpp(squads, rooms, w_dist, w_tier, max_iter);
    }  

    //we need it back because while returning again transition from C++ to python happens
    return result;   


}

PYBIND11_MODULE(solver_cpp, m) {
    m.doc() = "MatchPoint C++ solver extension";
    m.def("solve_heuristic_cpp", &solve_heuristic_py,
          py::arg("squads"),
          py::arg("rooms"),
          py::arg("w_dist") = 0.7,
          py::arg("w_tier") = 0.3,
          py::arg("max_iter") = 100,
          "C++ port of the Python heuristic. Returns (assignment, total_cost).");
}