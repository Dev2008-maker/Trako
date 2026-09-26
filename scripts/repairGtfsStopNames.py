"""Repairs src/data GTFS JSON: stop names/coords from stops.txt, route shapes via trips.shape_id.
Usage: python3 scripts/repairGtfsStopNames.py <gtfs_dir>"""
import csv, json, sys
g = sys.argv[1]
stops = {r["stop_id"]: r for r in csv.DictReader(open(f"{g}/stops.txt"))}
shape_of = {}
for t in csv.DictReader(open(f"{g}/trips.txt")):
    if t["direction_id"] == "0" and t["route_id"] not in shape_of:
        shape_of[t["route_id"]] = t["shape_id"]
for t in csv.DictReader(open(f"{g}/trips.txt")):
    shape_of.setdefault(t["route_id"], t["shape_id"])
pts = {}
for r in csv.DictReader(open(f"{g}/shapes.txt")):
    pts.setdefault(r["shape_id"], []).append((int(r["shape_pt_sequence"]), float(r["shape_pt_lon"]), float(r["shape_pt_lat"])))
def shape(sid):
    p = sorted(pts.get(sid, []))
    c = [[round(x, 5), round(y, 5)] for _, x, y in p]
    if len(c) > 120:
        step = -(-len(c) // 100); s = c[::step]
        if s[-1] != c[-1]: s.append(c[-1])
        c = s
    return c
D = "src/data/gtfsRouteDetails.json"; E = "src/data/gtfsExplorerRoutes.json"
d = json.load(open(D))
for rid, r in d.items():
    for s in r["stops"]:
        src = stops.get(s["stopId"])
        if src:
            s["name"] = src["stop_name"].strip() or "Unnamed stop"
            s["lat"] = float(src["stop_lat"]); s["lon"] = float(src["stop_lon"])
    if r["stops"]:
        r["origin"] = r["stops"][0]["name"]; r["destination"] = r["stops"][-1]["name"]
    r["shape"] = shape(shape_of.get(rid, "")) or [[s["lon"], s["lat"]] for s in r["stops"] if s["lat"] is not None]
json.dump(d, open(D, "w"), ensure_ascii=False, separators=(",", ":"))
e = json.load(open(E))
for r in e:
    det = d.get(r["id"])
    if det and det["stops"]:
        r["origin"] = det["origin"]; r["destination"] = det["destination"]
        r["stopNames"] = [s["name"] for s in det["stops"]][:10]
    r["operatingStatus"] = "Scheduled Service"
json.dump(e, open(E, "w"), ensure_ascii=False, indent=2)
