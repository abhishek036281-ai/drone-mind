const API_BASE = "/api";

// Initialize client-side fallback storage
function initLocalDB() {
    if (!localStorage.getItem("mock_drones")) {
        const drones = [
            { id: "D-01", organization_id: "org_cloud_kitchen", battery: 92, range: 25.0, payload: 5.0, status: "Available", location: [28.6139, 77.2090], health: 98, current_mission: null },
            { id: "D-02", organization_id: "org_cloud_kitchen", battery: 64, range: 20.0, payload: 3.0, status: "On Mission", location: [28.6189, 77.2130], health: 92, current_mission: "M-002" },
            { id: "D-03", organization_id: "org_cloud_kitchen", battery: 31, range: 30.0, payload: 8.0, status: "Charging", location: [28.6239, 77.2170], health: 94, current_mission: null },
            { id: "D-04", organization_id: "org_cloud_kitchen", battery: 78, range: 15.0, payload: 2.0, status: "Available", location: [28.6289, 77.2210], health: 96, current_mission: null },
            { id: "D-05", organization_id: "org_cloud_kitchen", battery: 95, range: 40.0, payload: 10.0, status: "Available", location: [28.6339, 77.2250], health: 99, current_mission: null },
            { id: "D-06", organization_id: "org_cloud_kitchen", battery: 55, range: 25.0, payload: 4.0, status: "Maintenance", location: [28.6389, 77.2290], health: 45, current_mission: null },
            { id: "D-07", organization_id: "org_cloud_kitchen", battery: 72, range: 35.0, payload: 6.0, status: "Available", location: [28.6439, 77.2330], health: 95, current_mission: null }
        ];
        localStorage.setItem("mock_drones", JSON.stringify(drones));
    }
    if (!localStorage.getItem("mock_missions")) {
        const missions = [
            { id: "M-001", organization_id: "org_cloud_kitchen", type: "Food Delivery", priority: "High", location: [28.6200, 77.2100], deadline: "15 mins", distance: 5.2, payload_req: 3.5, battery_req: 25, status: "Pending", assigned_drone: null },
            { id: "M-002", organization_id: "org_cloud_kitchen", type: "Express Meal", priority: "Emergency", location: [28.6350, 77.2250], deadline: "10 mins", distance: 8.1, payload_req: 3.0, battery_req: 30, status: "Active", assigned_drone: "D-02" },
            { id: "M-003", organization_id: "org_cloud_kitchen", type: "Catering Order", priority: "Normal", location: [28.6150, 77.2050], deadline: "30 mins", distance: 12.0, payload_req: 4.5, battery_req: 35, status: "Pending", assigned_drone: null },
            { id: "M-004", organization_id: "org_cloud_kitchen", type: "Cold Chain Delivery", priority: "High", location: [28.6400, 77.2300], deadline: "20 mins", distance: 6.5, payload_req: 5.0, battery_req: 35, status: "Pending", assigned_drone: null },
            { id: "M-005", organization_id: "org_cloud_kitchen", type: "Routine Package", priority: "Low", location: [28.6100, 77.2150], deadline: "45 mins", distance: 3.2, payload_req: 1.5, battery_req: 15, status: "Pending", assigned_drone: null }
        ];
        localStorage.setItem("mock_missions", JSON.stringify(missions));
    }
    if (!localStorage.getItem("mock_alerts")) {
        const alerts = [
            { id: "ALT-01", organization_id: "org_cloud_kitchen", message: "Drone D-06 placed in Maintenance (Health 45%).", severity: "warning", alert_type: "Maintenance", timestamp: "10:14 AM" },
            { id: "ALT-02", organization_id: "org_cloud_kitchen", message: "D-03 battery charging (31%).", severity: "info", alert_type: "Battery", timestamp: "10:20 AM" },
            { id: "ALT-03", organization_id: "org_cloud_kitchen", message: "Emergency delivery order M-002 assigned to D-02.", severity: "info", alert_type: "Emergency", timestamp: "10:22 AM" }
        ];
        localStorage.setItem("mock_alerts", JSON.stringify(alerts));
    }
    if (!localStorage.getItem("mock_orgs")) {
        const orgs = [
            { id: "org_cloud_kitchen", name: "Cloud Kitchen", business_type: "Restaurant", user_count: 3, status: "Active", created_at: "2026-08-10" },
            { id: "org_mediexpress", name: "MediExpress", business_type: "Healthcare", user_count: 2, status: "Active", created_at: "2026-08-12" },
            { id: "org_quickcart", name: "QuickCart Logistics", business_type: "E-Commerce", user_count: 5, status: "Active", created_at: "2026-08-14" }
        ];
        localStorage.setItem("mock_orgs", JSON.stringify(orgs));
    }
}

// Check server connectivity state
let clientFallbackActive = false;
const isDomainStatic = window.location.hostname.includes("github.io") || 
                       window.location.hostname.includes("netlify") || 
                       window.location.hostname.includes("vercel") ||
                       window.location.protocol === "file:";

if (isDomainStatic) {
    clientFallbackActive = true;
    initLocalDB();
}

function runLocalScheduler(drones, missions) {
    let availableDrones = drones.filter(d => d.status === "Available");
    let priorityMap = {"Emergency": 4, "High": 3, "Normal": 2, "Low": 1};
    let sortedMissions = [...missions].sort((a,b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));
    
    let assignments = [];
    let rejected = [];
    
    for (let mission of sortedMissions) {
        if (mission.status === "Completed") continue;
        
        let bestDrone = null;
        let bestScore = -1;
        let bestBreakdown = null;
        let bestReason = "";
        
        let missionRejected = [];
        
        for (let drone of availableDrones) {
            if (drone.battery < mission.battery_req) {
                missionRejected.push({ drone: drone.id, mission: mission.id, reason: "Insufficient battery" });
                continue;
            }
            if (drone.payload < mission.payload_req) {
                missionRejected.push({ drone: drone.id, mission: mission.id, reason: "Payload capacity exceeded" });
                continue;
            }
            if (drone.range < mission.distance) {
                missionRejected.push({ drone: drone.id, mission: mission.id, reason: "Range exceeded" });
                continue;
            }
            
            // Score
            let batteryMargin = drone.battery - mission.battery_req;
            let batScore = Math.min(30, Math.max(0, (batteryMargin / 100) * 30 * 2));
            let distScore = Math.max(0, 25 - mission.distance);
            let priorityScore = (priorityMap[mission.priority] || 1) * 5;
            let payloadMargin = drone.payload - mission.payload_req;
            let payloadScore = Math.max(0, 25 - (payloadMargin * 0.5));
            
            let score = Math.round((batScore + distScore + priorityScore + payloadScore) * 100) / 100;
            
            if (score > bestScore) {
                bestScore = score;
                bestDrone = drone;
                bestBreakdown = { battery: batScore, distance: distScore, deadline: priorityScore, payload: payloadScore, total: score };
                bestReason = `Selected ${drone.id} because it satisfies battery, range, and payload constraints.`;
            }
        }
        
        if (bestDrone) {
            assignments.push({
                mission: mission.id,
                assigned_drone: bestDrone.id,
                feasibility_score: bestScore,
                battery_after_mission: bestDrone.battery - mission.battery_req,
                distance: mission.distance,
                reason: bestReason,
                score_breakdown: bestBreakdown
            });
            availableDrones = availableDrones.filter(d => d.id !== bestDrone.id);
        } else {
            rejected.push(...missionRejected);
        }
    }
    return { assignments, rejected, message: "Optimization completed locally." };
}

const api = {
    async login(email, password) {
        if (clientFallbackActive) {
            console.warn("DroneMind: Relying on local client session fallback.");
            const role = email.includes("admin") ? "ADMIN" : "USER";
            return {
                user: {
                    id: role === "ADMIN" ? "usr_admin" : "usr_demo",
                    email: email,
                    role: role,
                    organization_id: role === "ADMIN" ? null : "org_cloud_kitchen"
                },
                token: "mock-session-key",
                message: "Logged in successfully (demo fallback)"
            };
        }
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) throw new Error("Invalid request");
            return res.json();
        } catch (err) {
            console.error("Server API login failed. Falling back to local storage engine.");
            clientFallbackActive = true;
            initLocalDB();
            return this.login(email, password);
        }
    },

    // Admin endpoints fallback mapping
    async getAdminOrganizations() {
        if (clientFallbackActive) {
            return JSON.parse(localStorage.getItem("mock_orgs"));
        }
        try {
            const res = await fetch(`${API_BASE}/admin/organizations`);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getAdminOrganizations();
        }
    },
    async getAdminDrones(orgId = "ALL") {
        if (clientFallbackActive) {
            let drones = JSON.parse(localStorage.getItem("mock_drones"));
            if (orgId && orgId !== "ALL") {
                drones = drones.filter(d => d.organization_id === orgId);
            }
            return drones;
        }
        try {
            const res = await fetch(`${API_BASE}/admin/drones?org_id=${orgId}`);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getAdminDrones(orgId);
        }
    },
    async getAdminMissions(orgId = "ALL") {
        if (clientFallbackActive) {
            let missions = JSON.parse(localStorage.getItem("mock_missions"));
            if (orgId && orgId !== "ALL") {
                missions = missions.filter(m => m.organization_id === orgId);
            }
            return missions;
        }
        try {
            const res = await fetch(`${API_BASE}/admin/missions?org_id=${orgId}`);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getAdminMissions(orgId);
        }
    },
    async getAdminAnalytics() {
        if (clientFallbackActive) {
            const drones = JSON.parse(localStorage.getItem("mock_drones"));
            const missions = JSON.parse(localStorage.getItem("mock_missions"));
            const active = drones.filter(d => d.status === "Available").length;
            const on_mission = drones.filter(d => d.status === "On Mission").length;
            return {
                total_organizations: 3,
                total_drones: drones.length,
                active_drones: active,
                on_mission: on_mission,
                charging: drones.filter(d => d.status === "Charging").length,
                maintenance: drones.filter(d => d.status === "Maintenance").length,
                total_missions: missions.length,
                emergency_missions: missions.filter(m => m.priority === "Emergency").length,
                fleet_utilization_pct: Math.round((on_mission / drones.length) * 100),
                avg_battery: 76.2
            };
        }
        try {
            const res = await fetch(`${API_BASE}/admin/analytics`);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getAdminAnalytics();
        }
    },
    async getAdminAlerts(orgId = "ALL") {
        if (clientFallbackActive) {
            let al = JSON.parse(localStorage.getItem("mock_alerts"));
            if (orgId && orgId !== "ALL") {
                al = al.filter(a => a.organization_id === orgId);
            }
            return al;
        }
        try {
            const res = await fetch(`${API_BASE}/admin/alerts?org_id=${orgId}`);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getAdminAlerts(orgId);
        }
    },

    // User endpoints fallback mapping
    async getDrones(orgId = null) {
        if (clientFallbackActive) {
            let drones = JSON.parse(localStorage.getItem("mock_drones"));
            if (orgId) drones = drones.filter(d => d.organization_id === orgId);
            return drones;
        }
        try {
            const url = orgId ? `${API_BASE}/drones?org_id=${orgId}` : `${API_BASE}/drones`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getDrones(orgId);
        }
    },
    async getMissions(orgId = null) {
        if (clientFallbackActive) {
            let missions = JSON.parse(localStorage.getItem("mock_missions"));
            if (orgId) missions = missions.filter(m => m.organization_id === orgId);
            return missions;
        }
        try {
            const url = orgId ? `${API_BASE}/missions?org_id=${orgId}` : `${API_BASE}/missions`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.getMissions(orgId);
        }
    },
    async runOptimization(orgId = null) {
        if (clientFallbackActive) {
            const drones = JSON.parse(localStorage.getItem("mock_drones"));
            const missions = JSON.parse(localStorage.getItem("mock_missions"));
            const result = runLocalScheduler(drones, missions);
            
            // Persist optimization changes locally
            result.assignments.forEach(a => {
                const dr = drones.find(d => d.id === a.assigned_drone);
                if (dr) {
                    dr.status = "On Mission";
                    dr.current_mission = a.mission;
                    dr.battery = a.battery_after_mission;
                }
                const ms = missions.find(m => m.id === a.mission);
                if (ms) {
                    ms.status = "Active";
                    ms.assigned_drone = a.assigned_drone;
                }
            });
            localStorage.setItem("mock_drones", JSON.stringify(drones));
            localStorage.setItem("mock_missions", JSON.stringify(missions));
            return result;
        }
        try {
            const url = orgId ? `${API_BASE}/optimize?org_id=${orgId}` : `${API_BASE}/optimize`;
            const res = await fetch(url, { method: "POST" });
            if (!res.ok) throw new Error("404");
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.runOptimization(orgId);
        }
    },
    async simulateFailure(droneId, orgId = null) {
        if (clientFallbackActive) {
            const drones = JSON.parse(localStorage.getItem("mock_drones"));
            const missions = JSON.parse(localStorage.getItem("mock_missions"));
            const target = drones.find(d => d.id === droneId);
            if (target) {
                target.status = "Maintenance";
                target.health = 0;
            }
            localStorage.setItem("mock_drones", JSON.stringify(drones));
            
            // Trigger auto re-optimization locally
            const activeMission = missions.find(m => m.assigned_drone === droneId && m.status === "Active");
            if (activeMission) {
                activeMission.status = "Pending";
                activeMission.assigned_drone = null;
                localStorage.setItem("mock_missions", JSON.stringify(missions));
                
                // Alert trigger
                let alerts = JSON.parse(localStorage.getItem("mock_alerts"));
                alerts.unshift({
                    id: "ALT-" + Date.now(),
                    organization_id: "org_cloud_kitchen",
                    message: "FAILURE DETECTED on Drone " + droneId + ". Triggering auto-reassignment.",
                    severity: "critical",
                    alert_type: "Emergency",
                    timestamp: "Just Now"
                });
                localStorage.setItem("mock_alerts", JSON.stringify(alerts));
                
                // Schedule re-optimization
                runLocalScheduler(drones, missions);
            }
            return { message: `Drone ${droneId} failed. Local re-optimization triggered.` };
        }
        try {
            const url = orgId ? `${API_BASE}/user/simulate/drone-failure?drone_id=${droneId}&org_id=${orgId}` : `${API_BASE}/simulate/drone-failure?drone_id=${droneId}`;
            const res = await fetch(url, { method: "POST" });
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.simulateFailure(droneId, orgId);
        }
    },
    async simulateEmergency(orgId = null) {
        if (clientFallbackActive) {
            const missions = JSON.parse(localStorage.getItem("mock_missions"));
            const newM = {
                id: "M-" + Math.floor(Math.random()*1000) + "-EMG",
                organization_id: "org_cloud_kitchen",
                type: "Emergency Response",
                priority: "Emergency",
                location: [28.6250, 77.2150],
                deadline: "Immediate",
                distance: 8.5,
                payload_req: 5.0,
                battery_req: 25,
                status: "Pending",
                assigned_drone: null
            };
            missions.unshift(newM);
            localStorage.setItem("mock_missions", JSON.stringify(missions));
            return newM;
        }
        try {
            const url = orgId ? `${API_BASE}/simulate/emergency?org_id=${orgId}` : `${API_BASE}/simulate/emergency`;
            const res = await fetch(url, { method: "POST" });
            return res.json();
        } catch (e) {
            clientFallbackActive = true;
            initLocalDB();
            return this.simulateEmergency(orgId);
        }
    }
};
