from pydantic import BaseModel


class DraftTopic(BaseModel):
    """A topic in the draft study plan (before being saved to DB)."""

    order_index: int
    title: str
    subtopics: list[str]
    is_completed: bool = False


# Type alias for a list of draft topics
DraftPlan = list[DraftTopic]


class SavePlanRequest(BaseModel):
    """Request to save the final edited plan and start studying."""

    topics: list[DraftTopic]


class RevisePlanRequest(BaseModel):
    """Request to ask AI to modify the draft plan."""

    instruction: str
