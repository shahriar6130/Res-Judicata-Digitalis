"""Supabase Python Client initialization for Auth, Storage, and PostgREST."""
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client = None


def get_supabase_client():
    """Retrieve or lazily initialize the Supabase client using project keys."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    supabase_url = settings.effective_supabase_url
    if not supabase_url:
        logger.info("Supabase URL not configured; Supabase client unavailable.")
        return None

    # Prefer service role key for backend operations if provided; fallback to anon key
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    if not key:
        logger.info("Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY configured.")
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(supabase_url, key)
        logger.info("Supabase client initialized successfully for project %s", supabase_url)
        return _supabase_client
    except Exception as exc:
        logger.warning("Could not initialize Supabase client: %s", exc)
        return None
