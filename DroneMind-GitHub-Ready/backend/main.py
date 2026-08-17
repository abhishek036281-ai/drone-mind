from fastapi import FastAPI, Depends, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os, uuid
from typing import Optional, List

from backend.database.database import engine, Base, get_db
from backend.models.models import Organization, User, Drone, Mission, Alert
from backend.schemas.schemas import (
    DroneBase, MissionBase, OrganizationBase, AlertBase, LoginRequest, LoginResponse, UserBase
)
from backend.optimization.scheduler import run_scheduler
from backend.utils.seed import seed_database

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="DroneMind B2B Platform API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed database on startup
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed_database(db, base_dir)

api_router = APIRouter(prefix="/api")

# ================= AUTHENTICATION =================
@api_router.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email")
    
    return LoginResponse(
        user=UserBase.from_orm(user),
        token=f"simulated-token-{user.id}",
        message=f"Logged in successfully as {user.role}"
    )

# ================= ADMIN ROUTES =================
@api_router.get("/admin/organizations", response_model=List[OrganizationBase])
def get_admin_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).all()

@api_router.get("/admin/drones", response_model=List[DroneBase])
def get_admin_drones(org_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Drone)
    if org_id and org_id != "ALL":
        query = query.filter(Drone.organization_id == org_id)
    return query.all()

@api_router.get("/admin/missions", response_model=List[MissionBase])
def get_admin_missions(org_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Mission)
    if org_id and org_id != "ALL":
        query = query.filter(Mission.organization_id == org_id)
    return query.all()

@api_router.get("/admin/alerts", response_model=List[AlertBase])
def get_admin_alerts(org_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Alert)
    if org_id and org_id != "ALL":
        query = query.filter(Alert.organization_id == org_id)
    return query.all()

@api_router.get("/admin/analytics")
def get_admin_analytics(db: Session = Depends(get_db)):
    total_orgs = db.query(Organization).count()
    total_drones = db.query(Drone).count()
    active_drones = db.query(Drone).filter(Drone.status == "Available").count()
    mission_drones = db.query(Drone).filter(Drone.status == "On Mission").count()
    charging_drones = db.query(Drone).filter(Drone.status == "Charging").count()
    maint_drones = db.query(Drone).filter(Drone.status == "Maintenance").count()
    total_missions = db.query(Mission).count()
    emergency_missions = db.query(Mission).filter(Mission.priority == "Emergency").count()
    
    return {
        "total_organizations": total_orgs,
        "total_drones": total_drones,
        "active_drones": active_drones,
        "on_mission": mission_drones,
        "charging": charging_drones,
        "maintenance": maint_drones,
        "total_missions": total_missions,
        "emergency_missions": emergency_missions,
        "fleet_utilization_pct": round((mission_drones / total_drones) * 100, 1) if total_drones > 0 else 0,
        "avg_battery": 74.5
    }

# ================= USER / BUSINESS ROUTES =================
@api_router.get("/user/drones", response_model=List[DroneBase])
def get_user_drones(org_id: str = Query(..., description="Organization ID"), db: Session = Depends(get_db)):
    return db.query(Drone).filter(Drone.organization_id == org_id).all()

@api_router.get("/user/missions", response_model=List[MissionBase])
def get_user_missions(org_id: str = Query(..., description="Organization ID"), db: Session = Depends(get_db)):
    return db.query(Mission).filter(Mission.organization_id == org_id).all()

@api_router.get("/user/alerts", response_model=List[AlertBase])
def get_user_alerts(org_id: str = Query(..., description="Organization ID"), db: Session = Depends(get_db)):
    return db.query(Alert).filter(Alert.organization_id == org_id).all()

@api_router.post("/user/optimize")
def run_user_optimization(org_id: str = Query("org_cloud_kitchen"), db: Session = Depends(get_db)):
    drones = db.query(Drone).filter(Drone.organization_id == org_id).all()
    missions = db.query(Mission).filter(Mission.organization_id == org_id).all()
    return run_scheduler(drones, missions)

@api_router.post("/user/simulate/drone-failure")
def simulate_user_drone_failure(drone_id: str, org_id: str = Query("org_cloud_kitchen"), db: Session = Depends(get_db)):
    drone = db.query(Drone).filter(Drone.id == drone_id, Drone.organization_id == org_id).first()
    if not drone:
        # Fallback to search by drone_id
        drone = db.query(Drone).filter(Drone.id == drone_id).first()
    if drone:
        drone.status = "Maintenance"
        drone.health = 0
        db.commit()
    return {"message": f"Drone {drone_id} marked as failed."}

@api_router.post("/user/simulate/emergency")
def simulate_user_emergency(org_id: str = Query("org_cloud_kitchen"), db: Session = Depends(get_db)):
    new_mission = Mission(
        id=f"M-{str(uuid.uuid4())[:4].upper()}-EMG",
        organization_id=org_id,
        type="Emergency Response",
        priority="Emergency",
        location=[28.6250, 77.2150],
        deadline="Immediate",
        distance=8.5,
        payload_req=5.0,
        battery_req=25,
        status="Pending"
    )
    db.add(new_mission)
    db.commit()
    db.refresh(new_mission)
    return new_mission

# ================= LEGACY COMPATIBILITY ROUTES =================
@api_router.get("/drones", response_model=List[DroneBase])
def get_drones(org_id: Optional[str] = None, db: Session = Depends(get_db)):
    if org_id and org_id != "ALL":
        return db.query(Drone).filter(Drone.organization_id == org_id).all()
    return db.query(Drone).all()

@api_router.get("/missions", response_model=List[MissionBase])
def get_missions(org_id: Optional[str] = None, db: Session = Depends(get_db)):
    if org_id and org_id != "ALL":
        return db.query(Mission).filter(Mission.organization_id == org_id).all()
    return db.query(Mission).all()

@api_router.post("/optimize")
def run_optimization(org_id: Optional[str] = None, db: Session = Depends(get_db)):
    if org_id and org_id != "ALL":
        drones = db.query(Drone).filter(Drone.organization_id == org_id).all()
        missions = db.query(Mission).filter(Mission.organization_id == org_id).all()
    else:
        drones = db.query(Drone).all()
        missions = db.query(Mission).all()
    return run_scheduler(drones, missions)

@api_router.post("/simulate/drone-failure")
def simulate_drone_failure(drone_id: str, db: Session = Depends(get_db)):
    drone = db.query(Drone).filter(Drone.id == drone_id).first()
    if drone:
        drone.status = "Maintenance"
        drone.health = 0
        db.commit()
    return {"message": f"Drone {drone_id} marked as failed."}

@api_router.post("/simulate/emergency")
def simulate_emergency(org_id: Optional[str] = "org_cloud_kitchen", db: Session = Depends(get_db)):
    new_mission = Mission(
        id=f"M-{str(uuid.uuid4())[:4].upper()}-EMG",
        organization_id=org_id,
        type="Emergency Response",
        priority="Emergency",
        location=[28.6250, 77.2150],
        deadline="Immediate",
        distance=8.5,
        payload_req=5.0,
        battery_req=25,
        status="Pending"
    )
    db.add(new_mission)
    db.commit()
    db.refresh(new_mission)
    return new_mission

from fastapi.staticfiles import StaticFiles

app.include_router(api_router)

# Mount frontend static files at root '/'
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

