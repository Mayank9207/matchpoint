"""PHASE 0 VERIFICATION (a): does POST /auth/verify-otp issue a token to anyone
who knows a verified user's email address, with no credential of any kind?

app/auth/routes.py::verify_otp_route opens with

    if user.get("is_verified", True) and not user.get("otp_hash"):
        return _token_response(user)

A user who has completed verification satisfies both halves: is_verified is True
and otp_hash was $unset on success.  The submitted `code` is never examined.

These tests assert the CORRECT behaviour (reject), so they are expected to FAIL
against current code.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest


async def _seed_verified_user(db, email: str = "victim@example.com") -> dict:
    """A normal, fully verified account -- exactly the post-signup steady state."""
    from app.auth.jwt_utils import hash_password

    user = {
        "email": email,
        "password_hash": hash_password("correct horse battery staple"),
        "display_name": "Victim",
        "is_verified": True,
        "auth_provider": "password",
        "created_at": datetime.now(timezone.utc),
        # NOTE: no otp_hash / otp_expires_at -- verify_otp_route $unset them.
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    return user


@pytest.mark.parametrize("bogus_code", ["000000", "999999", "123456", "abcdef"])
async def test_verify_otp_rejects_arbitrary_code_for_verified_user(
    client, db, bogus_code
):
    """An arbitrary code must NOT yield a token for a verified account."""
    await _seed_verified_user(db)

    response = await client.post(
        "/auth/verify-otp",
        json={"email": "victim@example.com", "code": bogus_code},
    )

    assert response.status_code != 200, (
        f"AUTH BYPASS: code {bogus_code!r} returned 200 with body "
        f"{response.json()!r} -- a token was issued with no credential check."
    )


async def test_verify_otp_does_not_leak_usable_token(client, db):
    """The stronger claim: the bypass token actually authenticates as the victim.

    Proves this is full account takeover, not just a bad status code.
    """
    await _seed_verified_user(db)

    response = await client.post(
        "/auth/verify-otp",
        json={"email": "victim@example.com", "code": "000000"},
    )

    if response.status_code != 200:
        return  # endpoint rejected it -- the other test covers that assertion

    token = response.json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert me.status_code != 200 or me.json()["email"] != "victim@example.com", (
        "FULL ACCOUNT TAKEOVER: token minted from an unchecked OTP authenticates "
        f"as {me.json()['email']} on /auth/me."
    )


async def test_verify_otp_with_no_challenge_in_progress_is_rejected(client, db):
    """Guards the intended contract: no outstanding OTP challenge -> no token.

    This is the invariant the early return violates; it should hold for every
    account state, verified or not.
    """
    await _seed_verified_user(db, email="nochallenge@example.com")

    response = await client.post(
        "/auth/verify-otp",
        json={"email": "nochallenge@example.com", "code": "111111"},
    )

    assert response.status_code == 400, (
        "Expected 400 'No verification in progress'; got "
        f"{response.status_code} {response.text}"
    )
