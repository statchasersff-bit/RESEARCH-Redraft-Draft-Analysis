"""
Extract one real draft example per strategy from cached Sleeper pick files.
Outputs data/output/redraft_draft_examples.json
"""

import json
import os
import random
from pathlib import Path

PICKS_DIR = Path("data/raw/sleeper/picks")
OUT_FILE  = Path("data/output/redraft_draft_examples.json")

TARGET_STRATEGIES = ["Robust RB", "Zero RB", "Hero RB", "WR Heavy", "Balanced Start"]

POS_COLORS = {"QB": "#ef4444", "RB": "#22c55e", "WR": "#3b82f6", "TE": "#f97316", "K": "#a855f7", "DEF": "#6b7280"}

def classify(picks_r1_5):
    positions = [p["position"] for p in picks_r1_5]
    rb = positions.count("RB")
    wr = positions.count("WR")
    qb = positions.count("QB")
    te = positions.count("TE")
    strategies = []
    if rb >= 3:
        strategies.append("Robust RB")
    if rb == 0:
        strategies.append("Zero RB")
    if rb == 1:
        strategies.append("Hero RB")
    if wr >= 3:
        strategies.append("WR Heavy")
    # Balanced: 1+ RB, 1+ WR, <=1 QB, <=1 TE, 4+ RB/WR combined
    if rb >= 1 and wr >= 1 and qb <= 1 and te <= 1 and (rb + wr) >= 4:
        strategies.append("Balanced Start")
    return strategies

def get_pick_label(pick):
    name = f"{pick['first_name']} {pick['last_name']}"
    pos  = pick["position"]
    team = pick.get("team", "")
    return {"name": name, "position": pos, "team": team}

def main():
    pick_files = sorted(PICKS_DIR.glob("*_picks.json"))
    random.seed(42)
    random.shuffle(pick_files)

    found = {}   # strategy -> example

    for path in pick_files:
        if len(found) == len(TARGET_STRATEGIES):
            break

        try:
            picks = json.loads(path.read_text())
        except Exception:
            continue

        if not picks or not isinstance(picks, list):
            continue

        # Group by roster_id, sorted by round then pick_no
        by_roster = {}
        for p in picks:
            rid = p.get("roster_id")
            if rid is None:
                continue
            meta = p.get("metadata") or {}
            pos = meta.get("position", "")
            if not pos or pos not in ("QB", "RB", "WR", "TE", "K", "DEF"):
                continue
            entry = {
                "round":      p["round"],
                "pick_no":    p["pick_no"],
                "first_name": meta.get("first_name", ""),
                "last_name":  meta.get("last_name", ""),
                "position":   pos,
                "team":       meta.get("team", ""),
            }
            by_roster.setdefault(rid, []).append(entry)

        for rid, roster_picks in by_roster.items():
            roster_picks.sort(key=lambda x: (x["round"], x["pick_no"]))

            r1_5 = [p for p in roster_picks if p["round"] <= 5]
            r1_8 = [p for p in roster_picks if p["round"] <= 8]

            if len(r1_5) < 5 or len(r1_8) < 8:
                continue

            strategies = classify(r1_5)

            for strat in strategies:
                if strat not in TARGET_STRATEGIES or strat in found:
                    continue

                # Group by round for display
                by_round = {}
                for pk in r1_8:
                    r = pk["round"]
                    by_round.setdefault(r, []).append(get_pick_label(pk))

                rounds = []
                for r in range(1, 9):
                    round_picks = by_round.get(r, [])
                    if round_picks:
                        rounds.append({
                            "round": r,
                            "picks": round_picks,
                        })

                found[strat] = {
                    "strategy": strat,
                    "draft_id": str(path.stem).replace("_picks", ""),
                    "roster_id": rid,
                    "rounds": rounds,
                }
                print(f"  Found: {strat} (draft {path.stem}, roster {rid})")

    # Order by TARGET_STRATEGIES
    examples = [found[s] for s in TARGET_STRATEGIES if s in found]
    print(f"\nFound {len(examples)}/{len(TARGET_STRATEGIES)} examples")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps({"examples": examples}, indent=2))
    print(f"Written to {OUT_FILE}")

if __name__ == "__main__":
    main()
