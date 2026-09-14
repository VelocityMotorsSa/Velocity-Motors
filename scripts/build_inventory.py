#!/usr/bin/env python3
"""
Fetches the AutoManager WebManager XML inventory feed and converts it
into a compact JSON file the website can read directly.

IMPORTANT: AutoManager limits this feed to 5 requests/day, so this
script must only run a few times a day via a scheduled GitHub Action,
never on every page load.
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

FEED_URL = "https://clients.automanager.com/afed6db0f03a45e99a735f6da6ecae0d/inventory.xml?ID=017852&Features=1&Photos=1"
OUTPUT_PATH = "data/inventory.json"
SOLD_PATH = "data/sold.json"
MAX_SOLD_ENTRIES = 12


def text_of(vehicle, tag, default=""):
    el = vehicle.find(tag)
    if el is None or el.text is None:
        return default
    return el.text.strip()


def parse_vehicle(vehicle):
    photos = [p.text.strip() for p in vehicle.findall("./PhotoURLs/PhotoURL") if p.text]
    features = []
    for cat in vehicle.findall("./Features/Category"):
        for f in cat.findall("Feature"):
            if f.text:
                features.append(f.text.strip())

    price_raw = text_of(vehicle, "InternetPrice") or text_of(vehicle, "ShowroomPrice")
    try:
        price = float(price_raw)
    except ValueError:
        price = 0.0

    try:
        mileage = int(float(text_of(vehicle, "Mileage", "0")))
    except ValueError:
        mileage = 0

    return {
        "id": text_of(vehicle, "ID"),
        "hasPhotos": len(photos) > 0,
        "stockNum": text_of(vehicle, "StockNum"),
        "vin": text_of(vehicle, "VIN"),
        "year": text_of(vehicle, "Year"),
        "make": text_of(vehicle, "Make"),
        "model": text_of(vehicle, "Model"),
        "trim": text_of(vehicle, "ModelNum"),
        "bodyStyle": text_of(vehicle, "Style"),
        "mileage": mileage,
        "transmission": text_of(vehicle, "Transmission"),
        "engine": text_of(vehicle, "Engine"),
        "drivetrain": text_of(vehicle, "Drivetrain"),
        "fuel": text_of(vehicle, "Fuel"),
        "extColor": text_of(vehicle, "ExtColor"),
        "extColorFactory": text_of(vehicle, "ExtColor_Factory"),
        "intColor": text_of(vehicle, "IntColor"),
        "intColorFactory": text_of(vehicle, "IntColor_Factory"),
        "price": price,
        "saleStatus": text_of(vehicle, "SaleStatus"),
        "photos": photos,
        "features": features,
        "vdpUrl": text_of(vehicle, "VdpUrl"),
    }


def load_previous_vehicles():
    """Read the inventory.json from the last run, if it exists, so we can
    detect which vehicles have disappeared (= sold) since then."""
    if not os.path.exists(OUTPUT_PATH):
        return []
    try:
        with open(OUTPUT_PATH) as f:
            old_data = json.load(f)
        return old_data.get("vehicles", [])
    except (json.JSONDecodeError, OSError):
        return []


def update_sold_list(previous_vehicles, current_vehicles):
    """Any vehicle present last run but missing this run is treated as
    sold. Adds it to data/sold.json (most recent first, capped list)."""
    current_ids = {v["id"] for v in current_vehicles}
    newly_sold = [v for v in previous_vehicles if v["id"] not in current_ids and v.get("hasPhotos")]

    if os.path.exists(SOLD_PATH):
        try:
            with open(SOLD_PATH) as f:
                sold_data = json.load(f)
        except (json.JSONDecodeError, OSError):
            sold_data = {"vehicles": []}
    else:
        sold_data = {"vehicles": []}

    existing_ids = {v["id"] for v in sold_data["vehicles"]}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for v in newly_sold:
        if v["id"] in existing_ids:
            continue
        sold_data["vehicles"].insert(0, {
            "id": v["id"],
            "year": v["year"],
            "make": v["make"],
            "model": v["model"],
            "trim": v["trim"],
            "bodyStyle": v["bodyStyle"],
            "mileage": v["mileage"],
            "photo": v["photos"][0] if v["photos"] else "",
            "soldDate": now,
        })

    sold_data["vehicles"] = sold_data["vehicles"][:MAX_SOLD_ENTRIES]

    with open(SOLD_PATH, "w") as f:
        json.dump(sold_data, f, indent=2)

    return len(newly_sold)


def build(xml_bytes):
    root = ET.fromstring(xml_bytes)
    vehicles = [parse_vehicle(v) for v in root.findall("Vehicle")]
    # Only keep vehicles actually available for sale.
    # NOTE: we deliberately do NOT drop vehicles with zero photos here —
    # those get a "Coming Soon" card on the site (see script.js) instead
    # of being hidden. If a DeskManager listing still never appears at
    # all, the AutoManager WebManager XML feed itself is excluding it
    # before this script ever sees it (see README note on the feed).
    vehicles = [v for v in vehicles if v["saleStatus"].lower() == "available" or v["saleStatus"] == ""]
    return {
        "clientId": root.attrib.get("clientId", ""),
        "updated": root.attrib.get("timeStamp", ""),
        "vehicles": vehicles,
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--local":
        # Local test mode: parse a file on disk instead of fetching live
        with open(sys.argv[2], "rb") as f:
            xml_bytes = f.read()
    else:
        req = urllib.request.Request(FEED_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            xml_bytes = resp.read()

    previous_vehicles = load_previous_vehicles()

    data = build(xml_bytes)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    newly_sold_count = update_sold_list(previous_vehicles, data["vehicles"])

    no_photo_count = sum(1 for v in data["vehicles"] if not v["hasPhotos"])
    print(f"Wrote {len(data['vehicles'])} vehicles to {OUTPUT_PATH} "
          f"({no_photo_count} showing as Coming Soon — no photos yet)")
    print(f"{newly_sold_count} vehicle(s) newly marked as sold in {SOLD_PATH}")


if __name__ == "__main__":
    main()
