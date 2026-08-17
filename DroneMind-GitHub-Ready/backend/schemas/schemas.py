from pydantic import BaseModel
from typing import List, Optional

class LoginRequest(BaseModel):
    email: str
    password: str

class UserBase(BaseModel):
    id: str
    email: str
    role: str
    organization_id: Optional[str] = None

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    user: UserBase
    token: str
    message: str

class OrganizationBase(BaseModel):
    id: str
    name: str
    business_type: str
    user_count: int
    status: str
    created_at: str

    class Config:
        from_attributes = True

class DroneBase(BaseModel):
    id: str
    organization_id: Optional[str] = "org_cloud_kitchen"
    battery: int
    status: str
    range: float
    payload: float
    location: List[float]
    health: int
    current_mission: Optional[str] = None

    class Config:
        from_attributes = True

class MissionBase(BaseModel):
    id: str
    organization_id: Optional[str] = "org_cloud_kitchen"
    type: str
    priority: str
    location: List[float]
    deadline: str
    distance: float
    payload_req: float
    battery_req: int
    status: str
    assigned_drone: Optional[str] = None

    class Config:
        from_attributes = True

class AlertBase(BaseModel):
    id: str
    organization_id: str
    message: str
    severity: str
    alert_type: str
    timestamp: str

    class Config:
        from_attributes = True

class ScoreBreakdown(BaseModel):
    battery: float
    distance: float
    deadline: float
    payload: float
    total: float

class AssignmentResponse(BaseModel):
    mission: str
    assigned_drone: str
    feasibility_score: float
    battery_after_mission: int
    distance: float
    reason: str
    score_breakdown: ScoreBreakdown

class RejectedCandidate(BaseModel):
    drone: str
    mission: str
    reason: str

class OptimizationResponse(BaseModel):
    assignments: List[AssignmentResponse]
    rejected: List[RejectedCandidate]
    message: str

class SimulatorRequest(BaseModel):
    drone_id: Optional[str] = None
    mission_id: Optional[str] = None
    battery_level: Optional[int] = None
    organization_id: Optional[str] = None
    details: Optional[dict] = None
