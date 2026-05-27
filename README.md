# 📍 MatchPoint

> A dynamic, geospatial matchmaking web application built to connect players and people based on real-world location and shared interests.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](#) [![MERN Stack](https://img.shields.io/badge/Stack-MERN-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#)

![My Screenshot](./images/Screenshot%20%28603%29.png)

---

## 🚀 Features

* **🌍 Geospatial Matchmaking:** Connects users based on real-world proximity using location data and the Google Maps API.
* **🔐 Secure Authentication:** Robust user registration and login system utilizing JSON Web Tokens (JWT) and encrypted passwords.
* **⚡ Blazing Fast Frontend:** Built with React and Vite for an incredibly responsive, single-page application experience.
* **📱 Fully Responsive:** Styled with modern Tailwind CSS to look pixel-perfect on mobile, tablet, and desktop displays.
* **🛡️ Bulletproof API:** Express.js backend fortified with custom CORS handling and global error middleware.

## 💻 Tech Stack

**Frontend:**
* React 19 (via Vite)
* Tailwind CSS
* React Router DOM
* Axios

**Backend:**
* Node.js & Express.js
* MongoDB (Mongoose)
* JWT for Authentication
* CORS & Cookie-Parser

**Deployment:**
* Frontend: [Vercel](https://vercel.com)
* Backend: [Render](https://render.com)
* Database: MongoDB Atlas

---

## ⚙️ Matching Engine (`engine/`)

The matching engine is a pure-Python library that assigns squads to rooms. It runs independently of the Node backend and has no network or database dependencies.

### What it solves

Each squad needs a room that matches its sport, fits within its travel radius, and falls inside its available time window. Rooms have fixed capacity. The goal is to maximise matched players, then minimise total cost (weighted distance + skill-tier gap) among all maximum-matching assignments.

This is a capacity-coupled assignment problem. Greedy assignment fails because a flexible squad making a locally optimal choice can consume capacity that a more constrained squad needs far more — the cost of that early mistake only becomes visible later. The engine uses OR-Tools CP-SAT for the oracle (correctness reference) and a multistart heuristic for the production path.

### Heuristic design

The heuristic runs three deterministic starting orderings (size-descending, least-flexible-first, cost-ascending) through FFD construction, then applies an interleaved local search:

- **1-opt relocate** — move a squad to a cheaper room with spare capacity
- **2-opt pairwise swap** — swap two squads between rooms if combined cost drops
- **Ejection chains** — evict a placed squad to make room for an unplaced one (player-count move)
- **Substitution** — replace an expensive placed squad with a cheaper unplaced one of equal or smaller size (cost move; freed capacity re-enters the pool)

### Benchmark results

Tested against the CP-SAT oracle across 15 configurations (5–30 squads, ratio 0.6–2.0):

- **13 / 15 configurations within 5% of optimal cost**, player count matching oracle exactly on all 15
- 2 known hard cases (documented in `engine/DESIGN.md`): a 20-squad full-room instance requiring 3-opt rotations, and an adversarial undersupplied instance requiring compound squad substitution

```bash
cd engine
python -m pytest test_solver_vs_oracle.py -v
# 13 passed, 2 xfailed
```

---

## 🛠️ Local Installation & Setup

Follow these steps to get MatchPoint running on your local machine.

### Prerequisites
* Node.js (v18+)
* MongoDB Atlas Account (or local MongoDB installation)
* Git

### 1. Clone the repository
```bash
git clone [https://github.com/Mayank9207/matchpoint.git](https://github.com/Mayank9207/matchpoint.git)
cd matchpoint
