"""Fine-tune a domain-specific embedding model (Phase 24).

Run on a machine with a GPU (Google Colab T4 is free and sufficient) once
training_pairs.json is ready:

    pip install sentence-transformers torch
    python scripts/finetune_embeddings.py

Output is saved to resume-analyzer-embeddings-v1/ and should be uploaded to a
private HuggingFace repo (Step 24.T.3), then swapped into
app/services/qdrant_service.py via the HF_TOKEN setting.
"""

import json

from sentence_transformers import InputExample, SentenceTransformer, losses
from torch.utils.data import DataLoader

PAIRS_PATH = "training_pairs.json"
BASE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
OUTPUT_PATH = "resume-analyzer-embeddings-v1"


def load_pairs(path: str = PAIRS_PATH) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    pairs = load_pairs()
    if len(pairs) < 50:
        print(f"Only {len(pairs)} pairs found — fine-tuning needs at least 50. Aborting.")
        return

    print(f"Loading base model: {BASE_MODEL}")
    model = SentenceTransformer(BASE_MODEL)

    train_examples = [
        InputExample(texts=[p["sentence1"], p["sentence2"]], label=float(p["label"]))
        for p in pairs
    ]
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)
    train_loss = losses.CosineSimilarityLoss(model)

    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=3,
        warmup_steps=100,
        output_path=OUTPUT_PATH,
    )
    print(f"Fine-tuning complete. Model saved to: {OUTPUT_PATH}/")


if __name__ == "__main__":
    main()
