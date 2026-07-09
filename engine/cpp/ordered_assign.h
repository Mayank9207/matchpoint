#pragma once

#include <vector>
#include <algorithm>


struct OrderedAssign {
    std::vector<int> val;     
    std::vector<int> order;  

    explicit OrderedAssign(int S) : val(S, -1) {}

    bool contains(int k) const { return val[k] != -1; }
    int at(int k) const { return val[k]; }

   
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
