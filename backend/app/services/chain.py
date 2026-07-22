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
