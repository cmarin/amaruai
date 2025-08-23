"""
Rate limiting middleware for workflow execution endpoints.
Prevents abuse and resource exhaustion.
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
from fastapi import HTTPException, Request
from collections import defaultdict
import asyncio
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """Simple in-memory rate limiter for workflow executions"""
    
    def __init__(self, max_requests: int = 10, window_minutes: int = 1):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum number of requests allowed in the time window
            window_minutes: Time window in minutes
        """
        self.max_requests = max_requests
        self.window = timedelta(minutes=window_minutes)
        self.requests: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None
        
    async def check_rate_limit(self, user_id: str, endpoint: str = "workflow") -> bool:
        """
        Check if user has exceeded rate limit.
        
        Args:
            user_id: User identifier
            endpoint: Endpoint being rate limited
            
        Returns:
            True if request is allowed, raises HTTPException if rate limited
        """
        key = f"{user_id}:{endpoint}"
        now = datetime.utcnow()
        
        # Clean up old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if now - req_time < self.window
        ]
        
        # Check rate limit
        if len(self.requests[key]) >= self.max_requests:
            wait_time = (self.requests[key][0] + self.window - now).total_seconds()
            logger.warning(f"Rate limit exceeded for user {user_id} on {endpoint}")
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Please wait {int(wait_time)} seconds before trying again.",
                headers={"Retry-After": str(int(wait_time))}
            )
        
        # Record this request
        self.requests[key].append(now)
        return True
    
    async def start_cleanup(self):
        """Start periodic cleanup of old request records"""
        while True:
            await asyncio.sleep(300)  # Clean up every 5 minutes
            self._cleanup_old_records()
    
    def _cleanup_old_records(self):
        """Remove old request records to prevent memory leak"""
        now = datetime.utcnow()
        for key in list(self.requests.keys()):
            self.requests[key] = [
                req_time for req_time in self.requests[key]
                if now - req_time < self.window
            ]
            if not self.requests[key]:
                del self.requests[key]

# Global rate limiter instances
workflow_rate_limiter = RateLimiter(max_requests=10, window_minutes=1)  # 10 requests per minute
workflow_hourly_limiter = RateLimiter(max_requests=100, window_minutes=60)  # 100 requests per hour

async def check_workflow_rate_limit(user_id: str):
    """Check both per-minute and per-hour rate limits for workflow execution"""
    await workflow_rate_limiter.check_rate_limit(user_id, "workflow_minute")
    await workflow_hourly_limiter.check_rate_limit(user_id, "workflow_hour")