"""Prepare sentence-pair training data for embedding fine-tuning (Phase 24).

Reads the exported training_data.jsonl and produces training_pairs.json in the
format consumed by finetune_embeddings.py:

    High score pairs (>= 70) -> similar -> label 1
    Low score pairs  (<= 40) -> dissimilar -> label 0

Run manually after export_training_data.py has produced a file with 500+
signals:

    .venv\\Scripts\\python.exe -m scripts.prepare_training_pairs
"""

import json
from pathlib import Path

INPUT_PATH = Path(__file__).resolve().parent.parent / "training_data.jsonl"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "training_pairs.json"

HIGH_SCORE = 70
LOW_SCORE = 40


def load_records(path: Path) -> list[dict]:
    if not path.exists():
        print(f"Missing {path} — run export_training_data.py first.")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def build_pairs(records: list[dict]) -> list[dict]:
    pairs = []
    skipped = 0
    for r in records:
        score = r.get("score")
        if not isinstance(score, int):
            continue
        if score >= HIGH_SCORE:
            label = 1.0
        elif score <= LOW_SCORE:
            label = 0.0
        else:
            skipped += 1
            continue

        # Snippets may be absent when store_resume_snippet is disabled — skip.
        if not r.get("resume_snippet") or not r.get("jd_snippet"):
            skipped += 1
            continue

        pairs.append(
            {
                "sentence1": r["resume_snippet"],
                "sentence2": r["jd_snippet"],
                "label": label,
            }
        )
    return pairs


if __name__ == "__main__":
    records = load_records(INPUT_PATH)
    pairs = build_pairs(records)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(pairs, f, ensure_ascii=False)
    print(f"Read {len(records)} signals, wrote {len(pairs)} training pairs to {OUTPUT_PATH}")
