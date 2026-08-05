"""Export training signals to JSONL for fine-tuning (Phase 24).

Run manually when you have collected enough signals:

    .venv\\Scripts\\python.exe -m scripts.export_training_data
"""

import asyncio
import json

from app.core.config import settings
from app.services.mongo_service import mongo_service


async def export(output_path: str = "training_data.jsonl") -> int:
    collection = mongo_service._get_collection()
    if collection is None:
        print("MongoDB unavailable — cannot export.")
        return 0

    training_signals = collection.database.training_signals
    records = []
    async for doc in training_signals.find({}, {"_id": 0}):
        records.append(doc)

    with open(output_path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Exported {len(records)} training signals to {output_path}")
    return len(records)


if __name__ == "__main__":
    asyncio.run(export())
