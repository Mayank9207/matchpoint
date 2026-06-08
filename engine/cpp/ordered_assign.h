#pragma once

#include <vector>
#include <algorithm>

// Insertion-ordered squad->room assignment.  Copied verbatim from the
// header-only reference (solver_cpp.h).  Local search must iterate the
// assignment in the same order the Python `dict` does (insertion order);
// std::map iterates by key, which diverges on instances where insertion
// order differs from key order.
//
//   keys   = squad indices [0, S); value = assigned room index, or -1.
struct OrderedAssign {
    std::vector<int> val;     // val[k] = room index, or -1 if unassigned
    std::vector<int> order;   // currently-present keys, in insertion order

    explicit OrderedAssign(int S) : val(S, -1) {}

    bool contains(int k) const { return val[k] != -1; }
    int at(int k) const { return val[k]; }

    // Insert (append) a new key, or update an existing one in place.
    void set(int k, int room) {
        if (val[k] == -1) order.push_back(k);
        val[k] = room;
    }

    void erase(int k) {
        if (val[k] == -1) return;
        val[k] = -1;
        order.erase(std::find(order.begin(), order.end(), k));
    }
};
