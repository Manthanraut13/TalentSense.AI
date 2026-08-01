from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.services.chain import get_llm
from app.services.mongo_service import learning_plans_collection

logger = logging.getLogger(__name__)

LEARNING_PLAN_SYSTEM_PROMPT = """You are a technical learning advisor. Given a skill and a job description context,
create a concise learning plan. Return ONLY valid JSON, no markdown."""

LEARNING_PLAN_HUMAN_PROMPT = """
Skill to learn: {skill}
Job context: {job_context}

Return ONLY this JSON:
{{
  "skill": "{skill}",
  "priority": "high" | "medium" | "low",
  "why_needed": "<1 sentence: why this matters for the role>",
  "estimated_weeks": <number>,
  "learning_path": [
    "<step 1: what to do first>",
    "<step 2>",
    "<step 3>"
  ],
  "search_queries": [
    "<query to find best free resource for beginners>",
    "<query for hands-on project>",
    "<query for official docs or course>"
  ]
}}
"""


_learning_chain = None


def get_learning_chain():
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    global _learning_chain
    if _learning_chain is None:
        parser = JsonOutputParser()
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", LEARNING_PLAN_SYSTEM_PROMPT),
                ("human", LEARNING_PLAN_HUMAN_PROMPT),
            ]
        )
        _learning_chain = prompt | get_llm() | parser
    return _learning_chain


def get_tavily_client():
    if not settings.tavily_api_key:
        return None
    from tavily import TavilyClient

    return TavilyClient(api_key=settings.tavily_api_key)


async def get_cached_plan(skill: str) -> dict | None:
    """Check MongoDB for a cached learning plan (7-day freshness window)."""
    collection = learning_plans_collection()
    if collection is None:
        return None

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        doc = await collection.find_one(
            {"skill": skill.lower(), "created_at": {"$gte": cutoff}},
            {"_id": 0},
        )
        return doc if doc else None
    except Exception as exc:
        logger.warning("Learning plan cache lookup failed: %s", exc)
        return None


async def cache_plan(plan: dict) -> None:
    """Save a learning plan to MongoDB."""
    collection = learning_plans_collection()
    if collection is None:
        return

    try:
        await collection.update_one(
            {"skill": plan["skill"].lower()},
            {"$set": {**plan, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Learning plan cache save failed: %s", exc)


def search_resources(query: str) -> list[dict]:
    """Use Tavily to find free learning resources."""
    client = get_tavily_client()
    if client is None:
        return []

    try:
        results = client.search(
            query=query,
            search_depth="basic",
            max_results=2,
            include_domains=[
                "youtube.com", "docs.python.org", "docs.docker.com",
                "kubernetes.io", "learn.microsoft.com", "developer.mozilla.org",
                "freecodecamp.org", "roadmap.sh", "coursera.org",
                "medium.com", "dev.to", "github.com",
            ],
        )
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", "")[:120],
                "type": "video" if "youtube.com" in r.get("url", "") else
                        "docs" if any(d in r.get("url", "") for d in ["docs.", ".io/docs", "developer."]) else
                        "course" if any(d in r.get("url", "") for d in ["coursera", "freecodecamp"]) else
                        "article",
            }
            for r in results.get("results", [])
        ]
    except Exception as exc:
        logger.warning("Tavily search failed: %s", exc)
        return []


async def generate_learning_plan(skill: str, job_context: str = "") -> dict:
    """
    Main entry point.
    Returns a full learning plan with resources.
    Checks cache first, generates + searches if not found.
    """
    # 1. Check cache
    cached = await get_cached_plan(skill)
    if cached:
        return cached

    # 2. Generate plan structure with LLM
    plan = await get_learning_chain().ainvoke({
        "skill": skill,
        "job_context": job_context[:200] if job_context else "general software engineering role",
    })

    # 3. Search for resources using Tavily (run searches in parallel)
    search_queries = plan.get("search_queries") or [
        f"learn {skill} for beginners free",
        f"{skill} hands-on project tutorial",
        f"{skill} official documentation",
    ]

    resource_lists = await asyncio.gather(
        *[asyncio.to_thread(search_resources, q) for q in search_queries[:3]],
        return_exceptions=True,
    )

    # Flatten and deduplicate resources by URL
    seen_urls = set()
    resources = []
    for result in resource_lists:
        if isinstance(result, list):
            for r in result:
                if r.get("url") and r["url"] not in seen_urls:
                    seen_urls.add(r["url"])
                    resources.append(r)

    plan["resources"] = resources[:6]  # Max 6 resources
    plan["skill"] = skill

    # 4. Cache and return
    await cache_plan(plan)
    return plan
