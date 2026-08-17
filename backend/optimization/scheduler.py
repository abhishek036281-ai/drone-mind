from typing import List, Dict, Any
from backend.models.models import Drone, Mission
from backend.schemas.schemas import AssignmentResponse, RejectedCandidate, ScoreBreakdown

def run_scheduler(drones: List[Drone], missions: List[Mission]) -> Dict[str, Any]:
    assignments = []
    rejected = []
    
    # Sort missions by priority 
    # (Emergency -> High -> Normal -> Low)
    priority_map = {"Emergency": 4, "High": 3, "Normal": 2, "Low": 1}
    sorted_missions = sorted(missions, key=lambda m: priority_map.get(m.priority, 0), reverse=True)
    
    available_drones = [d for d in drones if d.status == "Available"]

    for mission in sorted_missions:
        if mission.status == "Completed":
            # Mission already completed
            continue

        best_drone = None
        best_score = -1.0
        best_reason = ""
        
        mission_rejected_candidates = []

        best_bat, best_dist, best_prio, best_pay = 0.0, 0.0, 0.0, 0.0

        for drone in available_drones:
            # Constraint 1: Battery
            if drone.battery < mission.battery_req:
                mission_rejected_candidates.append(RejectedCandidate(
                    drone=drone.id,
                    mission=mission.id,
                    reason="Insufficient battery"
                ))
                continue
                
            # Constraint 2: Payload
            if drone.payload < mission.payload_req:
                mission_rejected_candidates.append(RejectedCandidate(
                    drone=drone.id,
                    mission=mission.id,
                    reason="Payload capacity exceeded"
                ))
                continue
                
            # Constraint 3: Range
            if drone.range < mission.distance:
                mission_rejected_candidates.append(RejectedCandidate(
                    drone=drone.id,
                    mission=mission.id,
                    reason="Range exceeded"
                ))
                continue
                
            # Score Calculation (100 point total)
            battery_margin = drone.battery - mission.battery_req
            bat_score = min(30.0, max(0.0, (battery_margin / 100.0) * 30.0 * 2.0))
            
            dist_score = min(25.0, max(0.0, 25.0 - mission.distance))
            
            priority_score = float(priority_map.get(mission.priority, 1) * 5)
            
            payload_margin = drone.payload - mission.payload_req
            payload_score = min(25.0, max(0.0, 25.0 - (payload_margin * 0.5)))
            
            score = round(bat_score + dist_score + priority_score + payload_score, 2)
            
            if score > best_score:
                best_score = score
                best_drone = drone
                best_bat, best_dist, best_prio, best_pay = bat_score, dist_score, priority_score, payload_score
                best_reason = f"Selected {drone.id} because it satisfies battery, range, and payload constraints with a strong score of {score:.1f}/100."

        if best_drone:
            # Assign drone
            assignments.append(AssignmentResponse(
                mission=mission.id,
                assigned_drone=best_drone.id,
                feasibility_score=best_score,
                battery_after_mission=best_drone.battery - mission.battery_req,
                distance=mission.distance,
                reason=best_reason,
                score_breakdown=ScoreBreakdown(
                    battery=round(best_bat, 1),
                    distance=round(best_dist, 1),
                    deadline=round(best_prio, 1),
                    payload=round(best_pay, 1),
                    total=best_score
                )
            ))
            # Remove this drone from available drones
            available_drones.remove(best_drone)
        else:
            # No drone found, append rejections for this mission
            rejected.extend(mission_rejected_candidates)
            
    return {
        "assignments": assignments,
        "rejected": rejected,
        "message": "Optimization completed successfully."
    }
