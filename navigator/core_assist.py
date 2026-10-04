"""Synchronous Core service boundary consumed by Platform.

The existing HTTP adapter consumes plan_questions/render_rule. The additive pure
text helpers are available for Platform integration without new response schemas.
"""
from .question_planner import plan_questions
from .rule_renderer import render_change, render_evaluation, render_rule

__all__ = ["plan_questions", "render_rule", "render_change", "render_evaluation"]
