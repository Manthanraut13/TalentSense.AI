import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class AnalysisServiceUnavailable(Exception):
    """Raised when the AI analysis service cannot return a valid result."""


def make_parser_and_prompt():
    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from app.core.prompts import ANALYSIS_HUMAN_PROMPT, ANALYSIS_SYSTEM_PROMPT
    from app.models.response import AIAnalysisPayload

    parser = PydanticOutputParser(pydantic_object=AIAnalysisPayload)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", ANALYSIS_SYSTEM_PROMPT),
            ("human", ANALYSIS_HUMAN_PROMPT),
        ]
    ).partial(format_instructions=parser.get_format_instructions())
    return parser, prompt


def get_llm():
    from langchain_groq import ChatGroq
    from app.core.config import settings

    return ChatGroq(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        temperature=settings.groq_temperature,
        max_tokens=settings.groq_max_tokens,
        timeout=30,
        max_retries=2,
    )


async def analyze(
    *,
    parsed_resume,
    job_description: str,
    past_context: str = "No past analysis context is available yet.",
) -> object:
    from app.core.config import settings

    if not settings.groq_api_key:
        raise AnalysisServiceUnavailable("Groq API key is not configured")

    parser, prompt = make_parser_and_prompt()
    llm = get_llm()

    messages = prompt.format_messages(
        resume_sections=format_resume_sections(parsed_resume),
        resume_text=parsed_resume.text,
        job_description=job_description,
        past_context=past_context,
    )

    try:
        response = await llm.ainvoke(messages)
        content = str(response.content)
        return parser.parse(content)
    except Exception as first_error:
        logger.warning("Initial Groq analysis parse/call failed: %s", first_error)

    try:
        fixed_response = await llm.ainvoke(
            [
                (
                    "system",
                    "You repair invalid analysis output. Return only valid JSON matching the schema.",
                ),
                (
                    "human",
                    "\n".join(
                        [
                            "The previous response could not be parsed.",
                            "Regenerate the complete analysis as valid JSON.",
                            parser.get_format_instructions(),
                            "Resume:",
                            parsed_resume.text,
                            "Job description:",
                            job_description,
                        ]
                    ),
                ),
            ]
        )
        return parser.parse(str(fixed_response.content))
    except Exception as second_error:
        logger.exception("Groq analysis failed after retry: %s", second_error)
        raise AnalysisServiceUnavailable(
            "LLM service temporarily unavailable"
        ) from second_error


def format_resume_sections(parsed_resume) -> str:
    if not parsed_resume.sections:
        return json.dumps(
            {
                "fallback": "No reliable section headers were detected. Use the raw resume text.",
            },
            ensure_ascii=True,
            separators=(',', ':'),
        )

    return json.dumps(parsed_resume.sections, ensure_ascii=True, separators=(',', ':'))


analyze_chain = type('AnalysisChain', (), {'analyze': staticmethod(analyze)})()


def get_comparison_chain():
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from app.core.prompts import COMPARISON_HUMAN_PROMPT, COMPARISON_SYSTEM_PROMPT

    parser = JsonOutputParser()
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", COMPARISON_SYSTEM_PROMPT),
            ("human", COMPARISON_HUMAN_PROMPT),
        ]
    )
    return prompt | get_llm() | parser


async def run_single_comparison(
    resume_text: str,
    job_description: str,
    jd_number: int,
    jd_label: str = "",
) -> dict:
    """Run analysis for one JD in the comparison set."""
    chain = get_comparison_chain()
    result = await chain.ainvoke({
        "resume_text": resume_text,
        "job_description": job_description,
        "jd_number": jd_number,
        "jd_label": jd_label or f"Job {jd_number}",
    })
    return result


async def run_comparison(resume_text: str, job_descriptions: list[str]) -> list[dict]:
    """
    Run all JD analyses in parallel using asyncio.gather.
    Returns list of results in same order as input JDs.
    """
    tasks = [
        run_single_comparison(
            resume_text=resume_text,
            job_description=jd,
            jd_number=i + 1,
        )
        for i, jd in enumerate(job_descriptions)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle partial failures — return error dict for failed ones
    processed = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning("Comparison analysis failed for JD %d: %s", i + 1, result)
            processed.append({
                "job_title": f"Job {i + 1}",
                "error": str(result),
                "scores": {"overall": 0, "skills_match": 0, "experience_relevance": 0, "keyword_coverage": 0},
                "missing_skills": [],
                "key_strengths": [],
                "biggest_gap": "Analysis failed",
                "fit_summary": "Could not analyze this job description.",
            })
        else:
            processed.append(result)
    return processed


def generate_recommendation(results: list[dict]) -> dict:
    """
    Pick the best JD and explain why.
    Called after all analyses complete.
    """
    valid = [(i, r) for i, r in enumerate(results) if "error" not in r]
    if not valid:
        return {"recommended_index": 0, "reasoning": "All analyses failed."}

    # Score formula: overall minus a penalty per missing skill
    def score_fn(r: dict) -> float:
        penalty = min(len(r.get("missing_skills", [])), 10) * 3
        return r["scores"]["overall"] - penalty

    best_idx, best = max(valid, key=lambda x: score_fn(x[1]))
    worst_idx, worst = min(valid, key=lambda x: score_fn(x[1]))

    return {
        "recommended_index": best_idx,
        "recommended_title": best.get("job_title", f"Job {best_idx + 1}"),
        "reasoning": (
            f"Strongest match at {best['scores']['overall']}% with only "
            f"{len(best.get('missing_skills', []))} skill gaps. "
            f"Your biggest strength here: {best.get('key_strengths', ['your experience'])[0]}."
        ),
        "avoid_index": worst_idx,
        "avoid_reason": worst.get("biggest_gap", "Significant skill gaps present."),
    }
