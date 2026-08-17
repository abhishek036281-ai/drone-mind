from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from backend.database.database import Base
import datetime

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True) # e.g. "org_cloud_kitchen"
    name = Column(String)                             # e.g. "Demo Cloud Kitchen"
    business_type = Column(String)                    # e.g. "Restaurant"
    user_count = Column(Integer, default=1)
    status = Column(String, default="Active")
    created_at = Column(String, default="2026-08-15")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)                            # "ADMIN" or "USER"
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)

class Drone(Base):
    __tablename__ = "drones"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), default="org_cloud_kitchen")
    battery = Column(Integer)
    status = Column(String)
    range = Column(Float)
    payload = Column(Float)
    location = Column(JSON) # Stored as [lat, lng] list
    health = Column(Integer)
    current_mission = Column(String, nullable=True)

class Mission(Base):
    __tablename__ = "missions"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), default="org_cloud_kitchen")
    type = Column(String)
    priority = Column(String)
    location = Column(JSON)
    deadline = Column(String)
    distance = Column(Float)
    payload_req = Column(Float)
    battery_req = Column(Integer)
    status = Column(String)
    assigned_drone = Column(String, nullable=True)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"))
    message = Column(String)
    severity = Column(String) # "info", "warning", "critical"
    alert_type = Column(String)
    timestamp = Column(String)

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    mission_id = Column(String, ForeignKey("missions.id"))
    drone_id = Column(String, ForeignKey("drones.id"))
    feasibility_score = Column(Float)
    reason = Column(String)

class SimulationEvent(Base):
    __tablename__ = "simulation_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    event_type = Column(String) # "FAILURE", "BATTERY_DROP", "EMERGENCY_MISSION", "CANCEL"
    target_id = Column(String)
    details = Column(JSON, nullable=True)
