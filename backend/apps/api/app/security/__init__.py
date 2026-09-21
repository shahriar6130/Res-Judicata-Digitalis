"""Shared server-side security policies for Shakkho."""

from app.security.authorization import (
    Action,
    ActorScope,
    AuthorizationDecision,
    ResourceScope,
    Role,
    authorize,
)

__all__ = [
    "Action",
    "ActorScope",
    "AuthorizationDecision",
    "ResourceScope",
    "Role",
    "authorize",
]
