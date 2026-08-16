# Issue bodies

Eleven confirmed findings, in severity order. Each block below is one issue:
title, labels, then the body to paste.

Evidence numbers are real and were produced during verification. Keep them.
If you trim anything for length, cut the fix plan prose, not the reproductions.

---

## Issue 1

**Title:** verify-otp issues a token with no credential check, full account takeover from an email address

**Labels:** `severity: critical`, `auth`

**Body:**

## What

`POST /auth/verify-otp` returns a valid access token for any verified account when given that account's email and an arbitrary code. The submitted code is never checked.

Knowing an email address is enough to take over the account. No password, no OTP, no rate limit in the path. Unauthenticated, pre-auth, single request.

## Where

`engine/backend/app/auth/routes.py:106-107`

```python
if user.get("is_verified", True) and not user.get("otp_hash"):
    return _token_response(user)
```

A fully verified account satisfies both halves by construction:

* `is_verified` is `True`, set on successful verification at line 129
* `otp_hash` is absent, because it is `$unset` on that same successful verification at line 130

Control flow returns at line 107, so `payload.code` is never compared against anything. The same holds for accounts created via `POST /auth/google`, which sets `is_verified: True` and unsets the OTP fields at lines 180-186.

## Severity: critical

Full account takeover of every verified user, from an email address alone. Remotely reachable, needs no prior access, and leaves no failed-attempt trail because the attempt counter is never touched.

It also silently defeats the mitigations in the other auth findings. Any rate limit or attempt cap added to the OTP path is bypassed entirely, because execution returns before reaching them.

## Reproduction

Verified against a real MongoDB 8.0.4, not a mock.

```
tests/test_auth_verify_otp_bypass.py  ->  6 failed
```

Seed an ordinary verified account, then:

```http
POST /auth/verify-otp
{"email": "victim@example.com", "code": "000000"}

200 OK
{"access_token": "eyJhbGciOiJIUzI1NiIs...", "token_type": "bearer",
 "user": {"email": "victim@example.com", ...}}
```

The token is fully usable, not just a bad status code. The escalation test confirms it authenticates as the victim:

```
AssertionError: FULL ACCOUNT TAKEOVER: token minted from an unchecked OTP
authenticates as victim@example.com on /auth/me.
```

Every code tried (`000000`, `999999`, `123456`, `abcdef`) returns 200.

## Fix plan

Delete the early return. It appears to exist to make `/auth/verify-otp` idempotent for an already verified user, but "already verified" is not a credential. The correct response is a rejection, not a token.

The endpoint's contract should be: no outstanding OTP challenge means no token, in every account state. That is already the behaviour of the code path immediately below, where lines 111-112 raise 400 "No verification in progress", so removing the early return lets a verified user with no challenge fall through to exactly the right error.

If the frontend depends on the idempotent success behaviour, that is a client bug to fix separately. It must not be paid for with an auth bypass. Check `frontend/src/pages/AccessTerminal.jsx` before patching.

## Guarding test

`engine/backend/tests/test_auth_verify_otp_bypass.py`

* `test_verify_otp_rejects_arbitrary_code_for_verified_user`, parametrized over four codes, asserts non-200
* `test_verify_otp_does_not_leak_usable_token`, the escalation case, asserts any issued token does not authenticate as the victim on `/auth/me`. This catches a fix that changes the status code without closing the hole.
* `test_verify_otp_with_no_challenge_in_progress_is_rejected`, asserts the positive contract of 400 when no challenge is outstanding

---

## Issue 2

**Title:** C++ extension is never rebuilt, equivalence suite validated a 13 day old binary

**Labels:** `severity: critical`, `ci`, `solver`

**Body:**

## What

Nothing in the repo ever rebuilds the C++ extension, and no CI runs the Python, C++, or Mongo test suites at all. As a result `test_cpp_equivalence.py` was passing 10 of 10 while validating a binary built from source that no longer existed in the tree.

The test's assertions were never too weak. They were reporting on 13 day old code.

## Where

`engine/test_cpp_equivalence.py:24`

```python
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "cpp", "build"))
```

The test imports whatever `.so` happens to be sitting in `cpp/build/`. There is no build step, no staleness check, and no guard that the binary matches the source.

Observed timestamps:

```
engine/cpp/solver_cpp.cpp     2026-06-21 15:08   source
engine/cpp/build/*.so         2026-06-08 22:27   binary, 13 days older
```

`.github/workflows/` contains only `webpack.yml` and `npm-publish.yml`, both Node boilerplate. `grep -niE "pytest|cmake|python|mongo" .github/workflows/` returns nothing.

## Severity: critical (process)

This is the finding that hid the others. Two real solver defects, over-capacity assignments and `room_load` corruption, sat in `main` behind a green test.

It will silently recur after every fix in this series unless CI owns the build. A developer who forgets to re-run `make` locally gets the same false green.

## Reproduction

Rebuild from current source and re-run the untouched test:

```bash
cd engine/cpp && mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release && make
cd ../.. && pytest test_cpp_equivalence.py
```

```
5 failed, 5 passed
FAILED slack_large, tight_small, tight_large, undersupplied_small, undersupplied_large
```

Feasibility sweep over 2400 generated instances, checking room load against capacity:

| binary | C++ output infeasible | Python infeasible |
|---|---|---|
| stale `.so` | 0 of 2400 | 0 |
| freshly built `.so` | 1679 of 2400 | 0 |

## Fix plan

Two parts, and the second is the one that matters.

1. Rebuild the artifact. `cpp/build/` is gitignored, so this is local hygiene, not a code change.
2. Make a stale binary impossible to test against:
   * CI (`.github/workflows/ci.yml`) builds the extension with CMake and pybind11 from a clean checkout before running pytest, so there is never a pre-existing `.so` to fall back on
   * add a MongoDB service container and run the backend suite, which currently runs nowhere
   * consider a conftest guard that compares `.so` mtime against the `.cpp` and `.h` sources and fails loudly rather than importing a stale module, which protects local runs too, where CI cannot help

Tracked for the CI phase, filed separately because it is a finding in its own right rather than just missing infrastructure.

## Guarding test

CI itself is the guard. A clean checkout build means the stale artifact failure mode cannot reoccur there.

The optional staleness assertion in `engine/conftest.py` guards local runs, which is where this bug actually bit.

---

## Issue 3

**Title:** substitution_move has no capacity check, emits over-capacity assignments

**Labels:** `severity: severe`, `solver`

**Body:**

## What

`substitution_move` swaps an unplaced squad `u` into a room occupied by placed squad `p` without checking that the room can hold `u`. Because the move requires `u.size >= p.size`, the room's load can only go up, so the missing check is not a rare edge case. It is on the move's main path.

The solver emits assignments that put more players in a room than it has capacity for.

## Where

`engine/cpp/solver_cpp.cpp:290-300`

```cpp
if(best_sub.has_value()){
    auto [delta, p_idx, r_idx] = best_sub.value();

    assignment.erase(p_idx);
    assignment[unplaced[u_idx]] = r_idx;

    room_load[r_idx] -= squads[p_idx].size;
    room_load[r_idx] += u.size;          // u.size >= p.size, so load INCREASES
    substituted = true;
}
```

The candidate filter above it, at lines 275-289, checks the size guard and `is_feasible` but never capacity:

```cpp
if(u.size < p.size)continue;      // size guard
if(!is_feasible(u,r))continue;    // feasibility guard
// no capacity check
```

`is_feasible(u, r)` only compares `u.size` against `r.capacity` in isolation. It knows nothing about what else is already in the room.

Python has the guard, at `engine/solver.py:235-237`:

```python
new_load = room_load[j] - squads[p].size + squads[u].size
if new_load > rooms[j].capacity:
    continue
```

## Severity: severe

Produces infeasible output, meaning a match assignment that overfills a venue. This is a correctness failure of the solver's core contract, and it reaches production through `app/matches/solver_bridge.py`.

Instrumenting the Python guard shows how often C++ takes a move Python refuses. On the existing 10 equivalence test configs alone, the guard rejects 52 substitutions that C++ would accept.

## Reproduction

Against a freshly built extension. This is invisible on the committed binary, see the stale `.so` issue.

```
5 of the 10 existing equivalence configs emit over-capacity assignments
1679 of 2400 swept instances emit over-capacity assignments
Python: 0 violations on every instance
```

Concrete, from `undersupplied_large` (n_squads=20, n_rooms=5, ratio=0.6, seed=207):

```
C++ room[0] load=12 > capacity=9   (over by 3)
C++ room[1] load=13 > capacity=8   (over by 5)
C++ room[2] load=11 > capacity=8   (over by 3)
C++ room[3] load=11 > capacity=8   (over by 3)
Python violations on same instance: none
```

## Fix plan

Add the capacity check to the candidate filter, mirroring Python:

```cpp
if(room_load[r_idx] - p.size + u.size > r.capacity)continue;
```

It belongs in the filter loop, not at apply time. A candidate that would overfill the room must not be eligible to win `best_sub`, otherwise it can shadow a legal substitution that would have been selected instead.

Note that this bug and the `relocate_move` load corruption both produce over-capacity output. They need fixing together before the feasibility invariant can go green, and the invariant test will stay red until both land.

## Guarding test

Solver invariant suite. The primary guard is a property test, not a golden output test.

* every output is feasible: for every generated instance, the sum of squad sizes in a room is at most that room's capacity, for all rooms. Runs against both solvers over the full sweep, so it catches any future move type that forgets the check.
* the existing `test_cpp_equivalence.py` configs also cover it indirectly, but only because Python happens to be correct here. The invariant test is what states the requirement directly.

---

## Issue 4

**Title:** relocate_move decrements the wrong room's load and compares against a stale score

**Labels:** `severity: severe`, `solver`

**Body:**

## What

Two defects in `relocate_move`.

1. `room_load` is corrupted on every single relocation. The origin room is never decremented and the destination is never credited, because of a statement order bug interacting with structured binding aliasing.
2. `current_score` is stale. It is computed once before the inner loop and never refreshed, so after one relocation the squad can be moved again to a room that is worse than where it currently sits.

## Where

`engine/cpp/solver_cpp.cpp:65-86`

```cpp
for(const auto& [s_idx, r_idx] : assignment){
    const Squad& s = squads[s_idx];
    const Room& current_room = rooms[r_idx];
    double current_score = score(s,current_room,w_dist,w_tier);   // (2) never updated

    for(int new_r_idx=0; new_r_idx<rooms.size(); new_r_idx++){
        ...
        if(new_score < current_score){
            assignment[s_idx] = new_r_idx;      // (1) r_idx aliases this node
            room_load[r_idx] -= s.size;         //     r_idx is ALREADY new_r_idx
            room_load[new_r_idx] += s.size;
            relocated = true;
        }
    }
}
```

### Correction to the original audit note

The audit called `r_idx` stale. It is the opposite. `r_idx` updates too eagerly. In `for(const auto& [s_idx, r_idx] : assignment)` the binding aliases the map node's `second`, so `assignment[s_idx] = new_r_idx` writes through to the very value `r_idx` names. The next line then reads the new room index.

Verified with a standalone probe reproducing the exact statement order:

```
before: r_idx=0 (origin room)
after  assignment[s]=1 : r_idx now reads 1
room_load = [5, 0]   (correct would be [0, 5])
```

So `room_load[r_idx] -= s.size` and `room_load[new_r_idx] += s.size` both hit the destination and cancel out. Net effect per relocation:

* the origin room keeps the squad's full load forever, phantom occupancy
* the destination room is credited nothing, so it reads as emptier than it is

The second half is what makes this severe. A room that has been relocated into looks like it has free space, so subsequent moves happily overfill it.

Python does it correctly at `engine/solver.py:137-140`, decrementing before reassigning, then advancing its cursor with `j = k`.

## Severity: severe

Independently produces over-capacity assignments, on top of the `substitution_move` capacity bug. Corrupted `room_load` also feeds every other move type: `swap_move`, `ejection_chain_move` and `substitution_move` all make their headroom decisions from it, so one relocation poisons the rest of the search.

The stale `current_score` additionally admits strictly degrading moves, which is what makes the local search able to cycle rather than settle. See the termination comment issue.

## Reproduction

The aliasing probe above is the direct, isolated proof.

End to end, this is one of the two causes behind:

```
1679 of 2400 swept instances produce over-capacity C++ output
Python: 0
```

## Fix plan

Reorder so the origin is decremented before the assignment is overwritten, and refresh the running score after a successful move:

```cpp
room_load[r_idx] -= s.size;          // decrement origin FIRST
room_load[new_r_idx] += s.size;
assignment[s_idx] = new_r_idx;       // then reassign
current_score = new_score;           // and refresh
```

Relying on the aliasing, even correctly, is a trap for the next reader. Prefer taking an explicit `int cur_r = r_idx;` copy at the top of the loop body and operating on that, so the code does not depend on subtle binding semantics at all. Worth deciding which of the two we want.

## Guarding test

Solver invariant suite.

* every output is feasible, shared with the substitution issue, catches the `room_load` corruption via its downstream effect
* player count never decreases across passes, catches degrading relocations
* a targeted unit test on a hand built two room instance asserting `room_load` matches a recount of the assignment after local search, so the corruption is caught directly rather than only through its symptoms

---

## Issue 5

**Title:** signup overwrites an unverified account's password_hash, account pre-hijacking

**Labels:** `severity: high`, `auth`

**Body:**

## What

`POST /auth/signup` on an existing unverified account overwrites that account's `password_hash` and `display_name` with attacker supplied values, with no authentication and no ownership check.

An unauthenticated attacker can overwrite the credential of any unverified account, given only the email address.

## Where

`engine/backend/app/auth/routes.py:70-82`

```python
if existing:
    if existing.get("is_verified", True):
        raise HTTPException(status_code=409, detail="Email already registered")
    await db.users.update_one(
        {"_id": existing["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.password),   # attacker's password
                "display_name": payload.display_name,
            }
        },
    )
    return await _issue_otp(db, existing["_id"], email)
```

Verified accounts are correctly rejected with 409. Unverified ones are treated as a signup still in progress, so the retry is allowed, but the retry is not tied to whoever started it.

## Severity: high

Classic account pre-hijacking, the unexpired session and unverified account family from the Microsoft pre-hijacking research.

Attack, where the victim signs up but does not immediately verify:

1. Victim signs up as `victim@example.com`. Account exists, `is_verified: False`, victim's password.
2. Attacker calls `/auth/signup` with the same email and the attacker's password. The hash is overwritten. A fresh OTP is mailed to the victim.
3. Victim receives an OTP they were expecting anyway and enters it. Verification succeeds.
4. The account is now verified and holds the attacker's password.

The victim sees a normal signup flow throughout. The attacker owns the account.

The reverse ordering also yields a denial primitive. An attacker who registers a victim's address first can keep resetting the credential on any account that has not yet been verified.

Combined with the `/auth/verify-otp` bypass, step 3 is not even needed, but these must be fixed independently, since fixing the bypass alone leaves this intact.

## Reproduction

To be written as the failing test below. Sequence:

```
POST /auth/signup  {email: victim@..., password: "victim-password-1", display_name: "Victim"}
POST /auth/signup  {email: victim@..., password: "attacker-password-9", display_name: "Victim"}
   -> 201, password_hash silently replaced

# after the victim verifies:
POST /auth/login   {email: victim@..., password: "attacker-password-9"}   -> 200  (should be 401)
POST /auth/login   {email: victim@..., password: "victim-password-1"}     -> 401  (should be 200)
```

Note that `_issue_otp` calls `send_otp_email`, which raises 503 when SMTP is unconfigured. The test seeds account state directly and asserts on the stored `password_hash`, so it does not depend on mail delivery.

## Fix plan

The unverified retry path needs to distinguish "same person retrying" from "someone else claiming this address". Options:

1. Do not overwrite the credential. Re-issue an OTP for the existing account but leave `password_hash` untouched. Simplest, and preserves the legitimate "I did not get the email" retry. A user who genuinely wants a different password can go through password reset after verifying.
2. Require the existing password to reuse an unverified registration, which turns the retry into an authenticated action.
3. Invalidate on takeover attempt, treating a mismatched password on an unverified account as a fresh registration that voids the old one. More complex, and offers an account enumeration oracle.

Option 1 is my recommendation. It closes the hole without adding a new credential prompt to the signup flow, and it keeps the retry ergonomics the current branch was written for.

Whichever we pick, `display_name` should stop being attacker controllable on this path too.

## Guarding test

`engine/backend/tests/test_auth_signup_prehijack.py`, to be written.

* `test_signup_does_not_overwrite_unverified_password`, asserts the stored `password_hash` still verifies the original password after a second signup with a different one
* `test_original_owner_can_still_log_in_after_second_signup`, end to end: verify the account, then assert the original password authenticates and the attacker's does not
* `test_signup_on_verified_account_still_409s`, pins the existing correct behaviour so the fix does not regress it

---

## Issue 6

**Title:** resend-otp has no rate limit and resets otp_attempts, attempt cap is unbounded

**Labels:** `severity: high`, `auth`

**Body:**

## What

`POST /auth/resend-otp` has no rate limit and resets `otp_attempts` to 0 on every call. The `otp_max_attempts` cap is therefore unbounded in practice. An attacker burns 4 guesses, calls resend, and gets 5 more, indefinitely.

## Where

`engine/backend/app/auth/routes.py:137-148` calls `_issue_otp`, which at lines 42-53 does:

```python
await db.users.update_one(
    {"_id": user_id},
    {
        "$set": {
            "otp_hash": hash_otp(code),
            "otp_expires_at": otp_expiry(),
            "otp_attempts": 0,          # cap reset, unconditionally
        }
    },
)
```

The cap it defeats is at lines 119-120:

```python
if user.get("otp_attempts", 0) >= get_settings().otp_max_attempts:
    raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")
```

There is no throttle on `resend-otp` itself. No per account cooldown, no per IP limit, no cap on resends per window.

## Severity: high

With a 6 digit code the space is 10^6. The attempt cap is the only thing standing between an attacker and brute force, and resend removes it at will. There is no lockout and no alerting, so the attack is unbounded in both rate and duration.

Two independent problems, and both need fixing. A rate limit alone still leaves the counter reset, and vice versa.

* counter reset: `otp_attempts` should not be cleared by the act of requesting a new code
* no throttle: unlimited resends are also an email bombing vector against arbitrary addresses, and burn SMTP quota

Note that each resend does rotate the code, so an attacker cannot accumulate guesses against a single fixed target. The realistic attack is a sustained low rate campaign across many accounts, plus the mail bombing angle. High rather than critical.

## Reproduction

To be written as the failing test below. Sequence:

```
for round in range(20):
    for _ in range(otp_max_attempts):
        POST /auth/verify-otp  {email, code: "000000"}   -> 400 invalid
    POST /auth/verify-otp      {email, code: "000000"}   -> 429 (cap reached)
    POST /auth/resend-otp      {email}                    -> 200, otp_attempts reset to 0
# 20 * otp_max_attempts guesses with no lockout, ever
```

`send_otp_email` raises 503 when SMTP is unconfigured, so the test seeds OTP state directly and asserts on the persisted `otp_attempts` rather than driving mail.

## Fix plan

Two changes.

1. Stop resetting the counter. Track attempts against the account, not against the individual code. Either drop `otp_attempts: 0` from `_issue_otp`, or move to a separate `otp_attempts_window_started_at` so the counter decays on a time basis rather than on demand.
2. Throttle resend. Persist `otp_last_sent_at` and reject resends inside a cooldown of 30 to 60 seconds, plus a ceiling on resends per rolling window, for example 5 per hour, after which the account is locked for a period.

Storage for both is a small addition to the user document, no new infrastructure needed. If you would rather push rate limiting to the edge, a proxy or API gateway is viable for the per IP half, but the per account counter still belongs in the application.

Worth deciding whether `/auth/verify-otp` and `/auth/login` should get the same treatment while we are here. Neither is throttled either.

## Guarding test

`engine/backend/tests/test_auth_otp_rate_limit.py`, to be written.

* `test_resend_does_not_reset_attempt_counter`, exhaust the cap, resend, assert `otp_attempts` is not back to 0 and the next guess still gets 429
* `test_resend_is_rate_limited`, two resends in quick succession, the second must be rejected with 429
* `test_attempt_cap_still_enforced_after_resend`, end to end, the total number of guesses accepted across N resends stays bounded

---

## Issue 7

**Title:** jwt_secret reused as the OTP HMAC key, no domain separation

**Labels:** `severity: medium`, `auth`

**Body:**

## What

`jwt_secret` is reused verbatim as the HMAC key for OTP hashing. One secret serves two cryptographic purposes with different threat models and different rotation needs, with no domain separation.

## Where

`engine/backend/app/auth/otp_utils.py:17-19`

```python
def hash_otp(code: str) -> str:
    secret = get_settings().jwt_secret.encode("utf-8")
    return hmac.new(secret, code.encode("utf-8"), hashlib.sha256).hexdigest()
```

Same value as `engine/backend/app/auth/jwt_utils.py:33`, which signs access tokens with `settings.jwt_secret`.

## Severity: medium

There is no known break here. HMAC-SHA256 and HS256 JWT signing do not interact in a way that leaks either key through normal use. The issue is structural, about blast radius and operational coupling.

* Rotation is coupled. Rotating `jwt_secret`, say after a suspected leak or on a routine schedule, silently invalidates every outstanding OTP, because the stored hashes no longer verify. Users mid signup get "invalid code" with no explanation. That is a real operational failure that will look like a mystery bug.
* Blast radius. A leak of the JWT secret becomes a leak of the OTP key too. An attacker who can forge tokens can also precompute OTP hashes, and with a 6 digit code the entire keyspace is 10^6, trivially enumerable offline against a stolen `otp_hash`.
* Confidentiality expectations differ. The JWT secret only signs. The OTP key protects a low entropy secret where offline enumeration is cheap.

Ranked below the auth bypass and pre-hijacking because exploiting it requires already having compromised the secret. This is a defence in depth and operability fix.

## Reproduction

Not a behavioural bug, so there is no failing request reproduction. It is demonstrable as a property:

```python
# same input, same output across both domains, one key, two uses
hash_otp("123456") == hmac.new(settings.jwt_secret.encode(), b"123456", sha256).hexdigest()
```

The rotation coupling is the observable failure:

```
1. user requests OTP, otp_hash stored, derived from jwt_secret
2. operator rotates jwt_secret
3. user submits the correct code -> 400 "Invalid verification code"
```

## Fix plan

Derive a separate key rather than adding another hand managed secret:

```python
# HKDF style separation from a single root secret
otp_key = hmac.new(settings.jwt_secret.encode(), b"matchpoint/otp/v1", hashlib.sha256).digest()
```

This gives domain separation with no new configuration and no deployment change. A distinct `OTP_SECRET` setting is the more conventional answer and is also fine, it just adds a secret to manage, and rotation still needs thought.

Two related points worth deciding at the same time:

* The OTP hash is unsalted and not per user, so identical codes produce identical hashes across accounts. Binding the user id into the HMAC input, `hash_otp(code, user_id)`, removes that and blocks precomputation. Given the 10^6 keyspace this matters more than the key separation does.
* Rotating `jwt_secret` will still invalidate outstanding OTPs unless the derivation is versioned. The `v1` label above leaves room for that.

## Guarding test

`engine/backend/tests/test_auth_otp_key_separation.py`, to be written.

* `test_otp_key_differs_from_jwt_secret`, asserts the key actually used for OTP HMAC is not the raw `jwt_secret`
* `test_otp_hash_is_user_scoped`, same code, two users, different stored hashes, if we take the per user binding
* `test_rotating_jwt_secret_does_not_invalidate_outstanding_otps`, the operability regression, if we go with a versioned derivation

---

## Issue 8

**Title:** std::map key order iteration diverges from Python dict insertion order, ordered_assign.h is unused

**Labels:** `severity: medium`, `solver`

**Body:**

## What

The C++ solver stores the assignment in `std::map<int,int>`, which iterates in key order. The Python solver stores it in a `dict`, which iterates in insertion order. Every move type iterates the assignment and resolves ties by first one seen, so the two solvers can pick different moves on identical input.

`engine/cpp/ordered_assign.h` was written specifically to fix this, and is included by nothing.

## Where

Unused header: `engine/cpp/ordered_assign.h`. Its own comment states the problem exactly:

> Local search must iterate the assignment in the same order the Python `dict` does (insertion order); `std::map` iterates by key, which diverges on instances where insertion order differs from key order.

Confirmed unused:

```
$ grep -rn "ordered_assign" engine/cpp --include=*.cpp --include=*.h --include=*.txt
(no hits outside the file itself)

$ grep -n add_module engine/cpp/CMakeLists.txt
16:pybind11_add_module(solver_cpp bindings.cpp solver_cpp.cpp)
```

Affected iteration sites in `solver_cpp.cpp`, all order sensitive:

* `relocate_move:65`, `for(const auto& [s_idx, r_idx] : assignment)`
* `swap_move:105-106`, nested iterator walk over pairs
* `ejection_chain_move:205`, eviction candidate scan
* `substitution_move:272`, `placed_pairs(assignment.begin(), assignment.end())`

Order matters because the selection tests are strict:

```cpp
if(!best_sub.has_value() || delta > std::get<0>(best_sub.value()))   // substitution_move:285
```

A strict `>` keeps the first candidate among equals, so iteration order decides ties. Python's `saving > best_sub[0]` at `solver.py:239` does the same, over a different order.

## Severity: medium

Correctness of equivalence rather than correctness of output. A divergent tie break still yields a feasible assignment, just not the same one Python picks. It does not overfill rooms on its own.

But it undermines the equivalence test as a safety net. `test_cpp_equivalence.py` asserts byte identical assignments, so any tie break divergence is a failure, and one that looks identical to a real bug during triage. Until this is resolved we cannot tell "C++ has a defect" from "C++ broke a tie differently".

That ambiguity is what makes it worth fixing before the oracle work, not after.

## Reproduction

Structural rather than instance specific. The divergence needs an instance where insertion order differs from key order and a tie occurs. The existing equivalence failures are dominated by the capacity bugs, so this one is currently masked. It should be re-assessed once those land.

That ordering is the plan: fix the capacity bugs first, re-run the equivalence suite, and see what residual divergence remains. If configs still fail with feasible but different assignments, this is the cause.

## Fix plan

Decide between two paths, and the header already implies the intended answer.

1. Wire in `OrderedAssign`. Replace `std::map<int,int>` in all five functions with the existing struct. `set`, `erase`, `contains` and `at` cover the current usage. Cost is that `erase` is O(n) via `std::find` on the order vector, which is fine at these sizes. This makes iteration order match Python by construction.
2. Remove the header and accept key order iteration, then relax the equivalence test to compare cost and player count rather than exact assignment.

Option 1 is my recommendation. Option 2 weakens the strongest assertion in the suite, and byte identical output is the property that made the C++ port reviewable against the Python reference in the first place.

One thing to check before committing to option 1: `ffd_assign` inserts in `order` sequence, so insertion order is already well defined, but `ejection_chain_move` and `substitution_move` insert and erase mid search. Confirm Python's resulting order is actually reproducible by `OrderedAssign` rather than assuming it.

## Guarding test

`test_cpp_equivalence.py` is the guard once the capacity bugs are fixed. It already asserts exact assignment equality across 10 configs.

Additionally:

* an expanded equivalence sweep over many more seeds, which raises the chance of hitting a tie break divergence
* a targeted test on a hand built instance where insertion order and key order deliberately disagree

---

## Issue 9

**Title:** No feasibility or cost memoization, haversine recomputed in every inner loop

**Labels:** `severity: low`, `solver`

**Body:**

## What

The C++ solver recomputes feasibility and cost, including two haversine calls, on every inner loop evaluation. Python precomputes both into S by R tables once and indexes them thereafter. The C++ port dropped that optimisation.

## Where

`engine/cpp/scoring_cpp.h:44-49`

```cpp
inline double score(const Squad& s, const Room& r, double w_dist, double w_tier) {
    if(!is_feasible(s,r))return std::numeric_limits<double> :: infinity();
    else return w_dist * (haversine_m(s,r)/s.max_distance) + w_tier * (std::abs(s.tier - r.desired_tier)/2.0);
}
```

`is_feasible` at line 38 computes `haversine_m` to test the distance constraint, then `score` computes it again for the cost term. Two sin, cos, asin and sqrt chains per `score` call.

Every move type calls `score` inside nested loops, per local search iteration:

* `relocate_move:68,75`, inside the S by R walk
* `swap_move:122-123`, four calls per candidate pair, O(S^2)
* `ejection_chain_move:178,217`, innermost of a triple loop, O(S * R^2)
* `substitution_move:282`, two calls per unplaced and placed pair

Python builds `feasible[i][j]` and `cost[i][j]` once at `solver.py:265-271` and never recomputes.

## Severity: low, performance only

No correctness impact. The values are deterministic, so recomputation returns the same answer. But the C++ port exists to be faster than Python, and this hands back much of that advantage.

Rough shape of the waste: Python does S by R haversine evaluations total. C++ does at least O(max_iter * S * R) from `relocate_move` alone, and `ejection_chain_move` contributes O(max_iter * S * R^2), each at two haversines per `score`. On `mid_contention_large`, 25 squads and 8 rooms over 100 iterations, that is a large constant factor against a table lookup.

Filed as low priority. It is a real regression against the port's stated purpose, but nothing is wrong with the output. Worth doing after the correctness issues land, and it should be measured rather than assumed.

## Reproduction

`engine/test_cpp_benchmark.py` already exists and is the right place to quantify this. It has not been run as part of this audit, so the numbers should come from an actual benchmark, before and after, rather than from the analysis above.

Note that the benchmark must be run against a freshly built extension. See the stale `.so` issue.

## Fix plan

Port Python's precompute into `solve_heuristic_cpp` before the ordering loop, and pass the tables down to the move functions:

```cpp
const int S = squads.size(), R = rooms.size();
std::vector<char>   feasible(S * R);      // char, not bool, avoids vector<bool> bit packing
std::vector<double> cost(S * R, std::numeric_limits<double>::infinity());
for (int i = 0; i < S; ++i)
    for (int j = 0; j < R; ++j)
        if ((feasible[i*R + j] = is_feasible(squads[i], rooms[j])))
            cost[i*R + j] = score(squads[i], rooms[j], w_dist, w_tier);
```

Flat `i*R + j` indexing as specified, one allocation, contiguous, cache friendly.

The tables are loop invariant across all three orderings, since they depend only on squads, rooms and weights, so build them once in `solve_heuristic_cpp` and reuse across all three passes rather than per pass.

Two things to settle here:

* The signature change touches all five move functions. Consider a small `struct Tables { int R; std::vector<char> feasible; std::vector<double> cost; }` passed by const reference, rather than threading two more parameters through each.
* Independently, `score` calling `is_feasible` and duplicating the haversine is wasteful even without memoization. That is a one line fix, compute the distance once and reuse it, and is worth doing regardless of whether we do the full precompute.

Fix this after the correctness issues. This refactor touches every move function, and doing it first would make the correctness diffs much harder to review.

## Guarding test

Performance work needs a guard against silently changing behaviour, not a perf assertion.

* `test_cpp_equivalence.py` must stay green across the refactor. That is the real safety net, since the precompute must be observationally identical.
* the solver invariant suite likewise
* optionally a benchmark regression check in `test_cpp_benchmark.py`, though wall clock assertions in CI are flaky. Prefer recording numbers over gating on them.

---

## Issue 10

**Title:** local_search termination comment claims a monotone objective that does not exist

**Labels:** `severity: low`, `solver`

**Body:**

## What

The comment above `local_search` claims a termination proof that does not hold:

> Run all four move types in a fixed order until no move improves the solution.
> Terminates because each move strictly improves a bounded objective.

There is no single objective that all four move types monotonically improve. Termination is actually guaranteed only by the `max_iter` bound.

## Where

`engine/cpp/solver_cpp.cpp:308-309`

## Severity: low

Documentation, not behaviour. Filed because the comment actively misleads. It tells the next reader that cycling is impossible, which is precisely the failure mode the `relocate_move` bug introduces. Someone trusting this comment would not think to look for it.

Why the claim fails, per move type:

* `swap_move`, strictly decreases cost. Holds.
* `substitution_move`, requires `delta > 0` so cost decreases, and `u.size >= p.size` so player count is non decreasing. Holds.
* `ejection_chain_move`, accepts the minimum delta chain regardless of sign, at `solver_cpp.cpp:218`, matching Python's accept any valid chain at `solver.py:210`. Player count strictly increases, but cost may increase too.
* `relocate_move`, intended to strictly decrease cost, but the stale `current_score` admits strictly degrading moves. See the relocate issue.

So even a lexicographic (players, -cost) argument does not close. `ejection_chain_move` trades cost for players, which is deliberate and fine, but `relocate_move` can currently worsen cost with no compensating gain. That combination is what permits cycling, bounded only by `max_iter` cutting the loop off.

## Reproduction

Not applicable, this is a documentation defect. The behavioural half is covered by the `relocate_move` issue.

## Fix plan

Rewrite the comment to state what is actually true, once the `relocate_move` fix lands. Something like:

```cpp
// Run all four move types in a fixed order until a full pass makes no change.
//
// Termination is bounded by max_iter, NOT by a monotone objective: relocate,
// swap and substitution each strictly decrease cost, but ejection chains
// deliberately accept a cost increase in exchange for a higher player count
// (player count beats cost in the priority order, matching the oracle).
// There is therefore no single decreasing potential over a full pass, and
// max_iter is a real bound rather than a safety net.
```

The audit also asks whether fixing `relocate_move` removes the degrading move case. Partially. It removes relocate's degrading moves, so relocate, swap and substitution become jointly monotone in cost. But `ejection_chain_move` still accepts cost increases by design, so the comment's original claim stays false even after the fix. The rewrite above reflects that.

If we wanted the strong claim to actually hold, the move would be to prove monotonicity in the lexicographic (players, -cost) order and check `ejection_chain_move` never decreases player count. That is a larger piece of work and probably not worth it, since `max_iter` is a perfectly reasonable bound. Worth a brief discussion though, since it is the kind of thing an interviewer may well ask about.

## Guarding test

Comments cannot be tested directly. The adjacent behavioural properties can:

* invariant: player count never decreases across passes, which pins the lexicographic priority the comment describes
* a convergence test asserting local search reaches a fixed point well inside `max_iter` on the standard configs. If a future change reintroduces cycling, that test regresses rather than the run silently burning all 100 iterations.

---

## Issue 11

**Title:** 24h token lifetime with no refresh or revocation (deferred, filed for the record)

**Labels:** `severity: low`, `auth`

**Body:**

## What

Access tokens live 24 hours, and there is no refresh mechanism and no way to revoke one. A leaked token is valid for up to a day and cannot be withdrawn.

Filed for the record. Not proposed for the current fix round.

## Where

`engine/backend/app/config.py:23`

```python
access_token_expire_minutes: int = 60 * 24
```

`engine/backend/app/auth/jwt_utils.py:22-33` issues the token. `decode_token` at line 36 validates signature and `exp` only. There is no `jti`, no denylist, and no server side session record, so nothing exists to revoke against.

## Severity: low, in current context

The 24h window is long, and stateless JWTs with no revocation is a known trade off rather than a defect. Sized as low because:

* there is no logout everywhere or password change flow today that should be invalidating tokens and silently is not
* the acute risk in this codebase is that tokens are trivially obtainable via the `/auth/verify-otp` bypass. Fix that and the exposure here drops sharply.

It becomes materially more important once the app has real users, or as soon as a password reset flow is added. A reset that cannot invalidate existing sessions is a genuine hole.

## Reproduction

Not a bug with a failing reproduction. Observable properties:

```
- token issued at T is accepted at T + 23h59m
- no endpoint exists that causes a previously issued token to stop working
- changing the user's password does not invalidate outstanding tokens
```

## Fix plan

Deliberately deferred. When we do take it, the conventional shapes are:

1. Short lived access token of 15 to 30 minutes plus a long lived refresh token stored server side, so refresh can be revoked.
2. Add a `jti` claim and a revocation list, Redis or a Mongo collection with a TTL index, checked on each request. Costs a lookup per request, which is the price of real revocation.
3. Add a `token_version` integer on the user document, included as a claim and compared on decode. Bumping it invalidates every outstanding token for that user. Cheapest option that gives logout everywhere and password change invalidation, without per request state.

Option 3 is a good fit here. It needs one field and one comparison, and it covers the case that actually matters, which is invalidating on credential change. Worth doing at the same time as any password reset feature.

Recommend leaving this open and unassigned until the auth fixes land.

## Guarding test

None for now. When implemented:

* `test_token_expires_after_configured_lifetime`
* `test_password_change_invalidates_existing_tokens`
* `test_revoked_token_is_rejected`
