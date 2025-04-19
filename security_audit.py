
import os
import json
import logging
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from flask import request
from flask_login import current_user
from models import db, User

logger = logging.getLogger(__name__)

@dataclass
class AuditEvent:
    event_type: str
    user_id: Optional[int]
    ip_address: str
    endpoint: str
    method: str
    status_code: int
    timestamp: datetime
    details: Dict

class SecurityAudit:
    def __init__(self):
        self.events: List[AuditEvent] = []
        
    def log_event(self, event_type: str, status_code: int = 200, details: Dict = None):
        event = AuditEvent(
            event_type=event_type,
            user_id=current_user.id if not current_user.is_anonymous else None,
            ip_address=request.remote_addr,
            endpoint=request.endpoint or '',
            method=request.method,
            status_code=status_code,
            timestamp=datetime.utcnow(),
            details=details or {}
        )
        self.events.append(event)
        self._persist_event(event)
    
    def _persist_event(self, event: AuditEvent):
        try:
            from models import AuditLog
            audit_log = AuditLog(
                event_type=event.event_type,
                user_id=event.user_id,
                ip_address=event.ip_address,
                endpoint=event.endpoint,
                method=event.method,
                status_code=event.status_code,
                details=json.dumps(event.details)
            )
            db.session.add(audit_log)
            db.session.commit()
        except Exception as e:
            logger.error(f"Failed to persist audit event: {str(e)}")

# Global security audit instance
security_audit = SecurityAudit()
