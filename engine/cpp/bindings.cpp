#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <vector>
#include <map>
#include <utility>

#include "types.h"
#include "solver_cpp.h"

namespace py = pybind11;

static std::vector<Squad> squads_from_py(const py::list& py_squads){
    std::vector<Squad> squads;

    squads.reserve(py::len(py_squads));

    int idx=0;

    for(const auto& obj:py_squads){

        Squad s;

        s.id=idx;
        s.size=obj.attr("size").cast<int>();
        s.sport=obj.attr("sport").cast<int>();
        s.tier=obj.attr("tier").cast<int>();
        s.lat=obj.attr("lat").cast<double>();
        s.lon=obj.attr("lon").cast<double>();
        s.max_distance=obj.attr("max_distance").cast<double>();
        s.start_time=obj.attr("start_time").cast<double>();
        s.end_time=obj.attr("end_time").cast<double>();

        squads.push_back(s);

        ++idx;
    }

    return squads;
}

static std::vector<Room> rooms_from_py(const py::list& py_rooms){
    std::vector<Room> rooms;

    rooms.reserve(py::len(py_rooms));
    int idx=0;

    for(const auto& obj:py_rooms){

        Room r;

        r.id=idx;
        r.sport=obj.attr("sport").cast<int>();
        r.desired_tier=obj.attr("desired_tier").cast<int>();
        r.capacity=obj.attr("capacity").cast<int>();
        r.lat=obj.attr("lat").cast<double>();
        r.lon=obj.attr("lon").cast<double>();
        r.match_time=obj.attr("match_time").cast<double>();

        rooms.push_back(r);

        ++idx;
    }

    return rooms;
}

static std::pair<std::map<int,int>,double> solve_heuristic_py(const py::list& py_squads, const py::list& py_rooms, double w_dist, double w_tier, int max_iter){

    std::vector<Squad> squads = squads_from_py(py_squads);
    std::vector<Room> rooms = rooms_from_py(py_rooms);


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