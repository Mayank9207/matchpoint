from __future__ import annotations

import argparse
import asyncio
import time

from app.config import get_settings
from motor.motor_asyncio import AsyncIOMotorClient

VENUES = [
    {"name": "TURFXL · KORAMANGALA", "sport": 0, "desired_tier": 1, "capacity": 10, "paid": True,  "price": 150,
     "image_url": "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=900&q=70"},
    {"name": "HOOP HOUSE · INDIRANAGAR", "sport": 1, "desired_tier": 1, "capacity": 10, "paid": False, "price": 0,
     "image_url": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=900&q=70"},
    {"name": "ACE COURTS · HSR",        "sport": 2, "desired_tier": 2, "capacity": 2,  "paid": True,  "price": 200,
     "image_url": None},
    {"name": "PITCH22 · WHITEFIELD",    "sport": 4, "desired_tier": 1, "capacity": 22, "paid": True,  "price": 120,
     "image_url": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=900&q=70"},
]


async def main(lat: float, lon: float) -> None:
    s = get_settings()
    db = AsyncIOMotorClient(s.mongodb_uri)[s.mongodb_db_name]

    removed = (await db.rooms.delete_many({"seed": True})).deleted_count
    now = time.time()
    docs = []
    for i, v in enumerate(VENUES):
        docs.append({
            **v,
            "seed": True,
            "lat": lat + i * 0.004,
            "lon": lon + i * 0.004,
            "match_time": now + 3600 + i * 1800,
        })
    res = await db.rooms.insert_many(docs)
    print(f"cleared {removed} prior seed room(s); inserted {len(res.inserted_ids)} venue(s) near ({lat}, {lon}).")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, default=12.9716)
    ap.add_argument("--lon", type=float, default=77.5946)
    asyncio.run(main(ap.parse_args().lat, ap.parse_args().lon))
