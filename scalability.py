
import os
import time
import psutil
import logging
from threading import Lock
from datetime import datetime
from typing import Dict, List
from dataclasses import dataclass
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

@dataclass
class ServerMetrics:
    cpu_usage: float
    memory_usage: float
    request_count: int
    last_updated: datetime

class LoadBalancer:
    def __init__(self):
        self._metrics_lock = Lock()
        self._server_metrics: Dict[str, ServerMetrics] = {}
        self._request_count = 0
        
    def record_metrics(self, server_id: str):
        with self._metrics_lock:
            self._server_metrics[server_id] = ServerMetrics(
                cpu_usage=psutil.cpu_percent(),
                memory_usage=psutil.virtual_memory().percent,
                request_count=self._request_count,
                last_updated=datetime.utcnow()
            )
            self._request_count += 1
    
    def get_metrics(self) -> Dict[str, ServerMetrics]:
        with self._metrics_lock:
            return self._server_metrics.copy()

    def get_server_load(self) -> float:
        try:
            return psutil.cpu_percent()
        except:
            return 0.0

# Global load balancer instance
load_balancer = LoadBalancer()
