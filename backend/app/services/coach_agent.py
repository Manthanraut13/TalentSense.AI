import asyncio
import logging
from typing import Annotated, Sequence, TypedDict

import operator

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)

_llm = None


def get_coach_llm():
    """Lazily build the coach LLM so importing this module never touches the network."""
    global _llm
    if _llm is None:
        from langchain_groq import ChatGroq

        from app.core.config import settings

        _llm = ChatGroq(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
            temperature=0.7,
            max_tokens=1024,
        )
    return _llm


class CoachState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    user_id: str
    user_context: str


async def load_user_context(state: CoachState) -> dict:
    """Load the user's recent analysis history as conversation context."""
    if state.get("user_context"):
        return {}

    history = await mongo_service.list_history(user_id=state["user_id"], limit=5)

    if not history.analyses:
        return {"user_context": "This user has not run any analyses yet."}

    full = await asyncio.gather(
        *[
            mongo_service.get_analysis(
                user_id=state["user_id"],
                analysis_id=item.analysis_id,
            )
            for item in history.analyses
        ],
        return_exceptions=True,
    )

    lines = ["User's recent job analyses:"]
    for item, analysis in zip(history.analyses, full):
        if isinstance(analysis, Exception) or analysis is None:
            missing: list[str] = []
        else:
            missing = list(analysis.missing_skills[:3])
        lines.append(
            f"- {item.job_title}: {item.scores.overall}% match "
            f"(missing: {', '.join(missing) or 'none noted'})"
        )

    return {"user_context": "\n".join(lines)}


def build_system_prompt(user_context: str) -> str:
    return f"""You are a friendly, expert career coach specializing in tech jobs.
You have access to the user's recent resume analysis history.

USER ANALYSIS HISTORY:
{user_context}

Your role:
- Give honest, specific, actionable career advice
- Reference their actual history when relevant ("I can see Kubernetes has appeared in 3 of your analyses...")
- Don't be generic — use specifics from their history
- Be encouraging but realistic
- Keep responses concise (3-5 sentences max unless a detailed breakdown is asked for)
- You can't run new analyses — direct them to the Analyze page for that
"""


async def coach_response(state: CoachState) -> dict:
    """Generate the AI coach response for the current turn."""
    system_prompt = build_system_prompt(state.get("user_context", "No history available."))
    messages_to_send = [
        SystemMessage(content=system_prompt),
        *state["messages"],
    ]

    response = await get_coach_llm().ainvoke(messages_to_send)
    return {"messages": [response]}


def should_continue(state: CoachState) -> str:
    """Always end after one response — this is a turn-based coach."""
    return "END"


def build_coach_graph():
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.graph import END, StateGraph

    builder = StateGraph(CoachState)
    builder.add_node("load_context", load_user_context)
    builder.add_node("respond", coach_response)
    builder.set_entry_point("load_context")
    builder.add_edge("load_context", "respond")
    builder.add_conditional_edges("respond", should_continue, {"END": END})

    memory = MemorySaver()
    return builder.compile(checkpointer=memory)


coach_graph = build_coach_graph()


async def chat_with_coach(
    user_id: str,
    message: str,
    conversation_id: str,
) -> str:
    """
    Send a message to the career coach and return the AI response text.

    conversation_id maintains session state across turns via the graph's
    in-memory checkpointer (thread_id = "user_id:conversation_id").
    """
    config = {"configurable": {"thread_id": f"{user_id}:{conversation_id}"}}

    result = await coach_graph.ainvoke(
        {
            "messages": [HumanMessage(content=message)],
            "user_id": user_id,
        },
        config=config,
    )

    ai_messages = [m for m in result["messages"] if isinstance(m, AIMessage)]
    return ai_messages[-1].content if ai_messages else "I'm having trouble responding right now."
