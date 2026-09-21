"""Base model definitions and mixins for SQLAlchemy."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class TenantModelMixin:
    """Base mixin providing UUID, tenancy, timestamps, and optimistic locking."""
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(64), nullable=False, default="default-tenant", index=True)
    created_at_server = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at_server = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_actor_id = Column(String(64), nullable=True)
    row_version = Column(Integer, default=1, nullable=False)
