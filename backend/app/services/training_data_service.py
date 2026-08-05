"""Phase 24 — Training signal collection for future fine-tuned embeddings.

Every completed analysis logs an anonymized (resume, job description) -> score
pair. Hashes are stored for identity; raw snippets are only stored when the
privacy setting ``store_resume_snippet`` is enabled. This data is exported and
used later to fine-tune a domain-specific embedding model.
"""

import hashlib
import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _training_signals_collection():
    """Return the training_signals collection, or None if MongoDB is unavailable."""
    collection = mongo_service._get_collection()
    if collection is None:
        return None
    return collection.database.training_signals


async def log_training_signal(
    *,
    user_id: str,
    resume_text: str,
    jd_text: str,
    score: int,
) -> bool:
    """Log a resume-JD pair with its score for future fine-tuning.

    This data is anonymized — no PII stored. Only sha256 hashes of the texts
    are guaranteed to persist; raw snippets are stored only if the privacy
    setting is enabled. Duplicate (resume, jd) pairs are skipped.
    """
    collection = _training_signals_collection()
    if collection is None:
        logger.warning("Training signal not logged: MongoDB unavailable")
        return False

    resume_hash = _hash(resume_text)
    jd_hash = _hash(jd_text)

    existing = await collection.find_one({"resume_hash": resume_hash, "jd_hash": jd_hash})
    if existing is not None:
        logger.debug("Training signal already exists for this resume/JD pair — skipping")
        return False

    document = {
        "resume_hash": resume_hash,
        "jd_hash": jd_hash,
        "score": score,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Only store snippets if explicitly enabled (privacy setting)
    if settings.store_resume_snippet:
        document["resume_snippet"] = resume_text[:500]
        document["jd_snippet"] = jd_text[:500]

    await collection.insert_one(document)
    logger.info("Training signal logged: score=%d, jd_hash=%s", score, jd_hash[:12])
    return True
