import json
import os
from sqlalchemy.orm import Session
from backend.models.models import Organization, User, Drone, Mission, Alert

def seed_database(db: Session, base_dir: str):
    # Always drop existing data if old structure exists, or re-seed cleanly
    if db.query(Organization).first() is not None:
        # Check if drone count is 7, if not clear and re-seed
        if db.query(Drone).count() == 7:
            return
        db.query(Alert).delete()
        db.query(Mission).delete()
        db.query(Drone).delete()
        db.query(User).delete()
        db.query(Organization).delete()
        db.commit()

    print("Seeding database for EXACT 7-Drone Multi-Tenant Architecture...")

    # 1. Add Organizations
    orgs = [
        Organization(id="org_cloud_kitchen", name="Cloud Kitchen", business_type="Restaurant Logistics", user_count=3, status="Active", created_at="2026-08-10"),
        Organization(id="org_mediexpress", name="MediExpress", business_type="Healthcare & Medical", user_count=2, status="Active", created_at="2026-08-12"),
        Organization(id="org_quickcart", name="QuickCart Logistics", business_type="E-commerce Delivery", user_count=5, status="Active", created_at="2026-08-14"),
    ]
    for org in orgs:
        db.add(org)

    # 2. Add Users
    users = [
        User(id="usr_admin", email="admin@dronemind.ai", password_hash="admin123", role="ADMIN", organization_id=None),
        User(id="usr_demo", email="demo@dronemind.ai", password_hash="demo123", role="USER", organization_id="org_cloud_kitchen"),
        User(id="usr_medi", email="medi@dronemind.ai", password_hash="medi123", role="USER", organization_id="org_mediexpress"),
        User(id="usr_quick", email="quick@dronemind.ai", password_hash="quick123", role="USER", organization_id="org_quickcart"),
    ]
    for u in users:
        db.add(u)

    # 3. Add EXACTLY 7 Prototype Drones:
    # D-01: Battery 92%, Range 25 km, Payload 5 kg, Status Available
    # D-02: Battery 64%, Range 20 km, Payload 3 kg, Status On Mission
    # D-03: Battery 31%, Range 30 km, Payload 8 kg, Status Charging
    # D-04: Battery 78%, Range 15 km, Payload 2 kg, Status Available
    # D-05: Battery 95%, Range 40 km, Payload 10 kg, Status Available
    # D-06: Battery 55%, Range 25 km, Payload 4 kg, Status Maintenance
    # D-07: Battery 72%, Range 35 km, Payload 6 kg, Status Available

    drones = [
        Drone(id="D-01", organization_id="org_cloud_kitchen", battery=92, range=25.0, payload=5.0, status="Available", location=[28.6139, 77.2090], health=98, current_mission=None),
        Drone(id="D-02", organization_id="org_cloud_kitchen", battery=64, range=20.0, payload=3.0, status="On Mission", location=[28.6189, 77.2130], health=92, current_mission="M-002"),
        Drone(id="D-03", organization_id="org_cloud_kitchen", battery=31, range=30.0, payload=8.0, status="Charging", location=[28.6239, 77.2170], health=94, current_mission=None),
        Drone(id="D-04", organization_id="org_cloud_kitchen", battery=78, range=15.0, payload=2.0, status="Available", location=[28.6289, 77.2210], health=96, current_mission=None),
        Drone(id="D-05", organization_id="org_cloud_kitchen", battery=95, range=40.0, payload=10.0, status="Available", location=[28.6339, 77.2250], health=99, current_mission=None),
        Drone(id="D-06", organization_id="org_cloud_kitchen", battery=55, range=25.0, payload=4.0, status="Maintenance", location=[28.6389, 77.2290], health=45, current_mission=None),
        Drone(id="D-07", organization_id="org_cloud_kitchen", battery=72, range=35.0, payload=6.0, status="Available", location=[28.6439, 77.2330], health=95, current_mission=None),
    ]

    for d in drones:
        db.add(d)

    # 4. Add Missions
    missions = [
        Mission(id="M-001", organization_id="org_cloud_kitchen", type="Food Delivery", priority="High", location=[28.6200, 77.2100], deadline="15 mins", distance=5.2, payload_req=3.5, battery_req=25, status="Pending"),
        Mission(id="M-002", organization_id="org_cloud_kitchen", type="Express Meal", priority="Emergency", location=[28.6350, 77.2250], deadline="10 mins", distance=8.1, payload_req=3.0, battery_req=30, status="Active", assigned_drone="D-02"),
        Mission(id="M-003", organization_id="org_cloud_kitchen", type="Catering Order", priority="Normal", location=[28.6150, 77.2050], deadline="30 mins", distance=12.0, payload_req=4.5, battery_req=35, status="Pending"),
        Mission(id="M-004", organization_id="org_cloud_kitchen", type="Cold Chain Delivery", priority="High", location=[28.6400, 77.2300], deadline="20 mins", distance=6.5, payload_req=5.0, battery_req=35, status="Pending"),
        Mission(id="M-005", organization_id="org_cloud_kitchen", type="Routine Package", priority="Low", location=[28.6100, 77.2150], deadline="45 mins", distance=3.2, payload_req=1.5, battery_req=15, status="Pending"),
    ]
    for m in missions:
        db.add(m)

    # 5. Add System Alerts
    alerts = [
        Alert(id="ALT-01", organization_id="org_cloud_kitchen", message="Drone D-06 placed in Maintenance (Health 45%).", severity="warning", alert_type="Maintenance", timestamp="10:14 AM"),
        Alert(id="ALT-02", organization_id="org_cloud_kitchen", message="D-03 battery charging (31%).", severity="info", alert_type="Battery", timestamp="10:20 AM"),
        Alert(id="ALT-03", organization_id="org_cloud_kitchen", message="Emergency delivery order M-002 assigned to D-02.", severity="info", alert_type="Emergency", timestamp="10:22 AM"),
    ]
    for a in alerts:
        db.add(a)

    db.commit()
    print("Exact 7-Drone database seeding completed successfully.")
