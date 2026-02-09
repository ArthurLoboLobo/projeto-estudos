"""Centralized AI prompt templates.

All system prompts and user prompt templates live here so they're easy to find,
review, and edit in one place. Services import the constants they need.

Naming convention:
  - System prompts:       <FEATURE>_SYSTEM_PROMPT
  - User prompt templates: <FEATURE>_USER_PROMPT_TEMPLATE
"""

# ---------------------------------------------------------------------------
# Language utilities
# ---------------------------------------------------------------------------

LANGUAGE_NAMES = {
    "en": "English",
    "pt": "Portuguese",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
}


def language_name(code: str) -> str:
    """Convert a language code (e.g. 'pt') to its full name (e.g. 'Portuguese')."""
    return LANGUAGE_NAMES.get(code, code)


# ---------------------------------------------------------------------------
# Vision — PDF page text extraction
# ---------------------------------------------------------------------------

VISION_EXTRACTION_PROMPT = """You are extracting content from an academic document page.

Extract ALL text from this page exactly as shown, preserving the original language.

For any mathematical formulas, equations, chemical formulas, or scientific notation:
- Represent them in LaTeX format using $...$ for inline math and $$...$$ for block equations
- Preserve the exact meaning and structure of the formulas

For tables:
- Format them clearly with proper alignment

For bullet points and numbered lists:
- Preserve the structure

Output the extracted content in plain text with LaTeX formulas embedded where appropriate.
Do not add any commentary or explanations - just extract the content as-is."""

# ---------------------------------------------------------------------------
# Study plan generation (incremental, one document at a time)
# ---------------------------------------------------------------------------

PLAN_SYSTEM_PROMPT = (
    "You are an expert academic tutor creating a personalized study plan for a "
    "university student. You will receive the current study plan (which may be "
    "empty) and a new document's extracted text. Your job is to update the plan "
    "based on the new document.\n\n"
    "Output ONLY a valid JSON array. No markdown code blocks, no explanation, "
    "no surrounding text."
)

PLAN_USER_PROMPT_TEMPLATE = """<language>
Generate all content (titles, subtopics) in **{language}**.
</language>

<current_plan>
{current_plan}
</current_plan>

<new_document>
{document_text}
</new_document>

<instructions>
Update the study plan based on the new document. Follow these rules:

1. **Format:** Return a JSON array of objects:
   [
     {{
       "order_index": 1,
       "title": "Topic Title",
       "subtopics": ["Subtopic 1", "Subtopic 2"]
     }}
   ]

2. **Behaviors:**
   - Create new topics when the document introduces concepts not in the current plan
   - Add subtopics to existing topics when the document contains related content
   - Update topic titles if a better name emerges from the document
   - Reorder topics if the document suggests a different logical sequence
   - Merge topics if they are too granular
   - Split topics if they are too broad
   - Keep order_index values sequential starting from 1

3. **Quality:**
   - Group concepts that make sense to learn together
   - Sequence from foundational to advanced
   - Focus on content topics only (ignore administrative info like grading, professor names, dates)
   - Each topic should have at least 2 subtopics
   - Subtopics should be specific and actionable (e.g., "Calculate limits using L'Hopital's rule" instead of "Limits")

4. **Output:** Valid JSON array only. No markdown, no explanation, no code blocks.
</instructions>"""
