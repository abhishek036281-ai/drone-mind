let state = {
    drones: [],
    missions: [],
    organizations: [],
    alerts: [],
    analytics: null
};

let currentSession = {
    user: null,
    role: null, // "ADMIN" or "USER"
    token: null,
    organization_id: null,
    org_name: null
};

let optStats = { time: '--:--', total: '--', feasible: '--', reassigned: '--', unassigned: '--' };

let map;
let fleetChart;
let priorityChart;
let adminFleetChart;
let adminMissionChart;
let mapMarkers = [];

document.addEventListener("DOMContentLoaded", () => {
    checkExistingSession();
    document.getElementById("btn-run-optimization").addEventListener("click", handleRunOptimization);
});

function checkExistingSession() {
    const saved = localStorage.getItem("dronemind_session");
    if (saved) {
        try {
            currentSession = JSON.parse(saved);
            initAuthenticatedSession();
            return;
        } catch(e) {
            localStorage.removeItem("dronemind_session");
        }
    }
    showLoginOverlay();
}

function showLoginOverlay() {
    document.getElementById("login-overlay").style.display = "flex";
    document.getElementById("main-app").style.display = "none";
}

window.passwordlessLogin = async function(role) {
    if (role === "ADMIN") {
        await performLogin("admin@dronemind.ai", "admin123");
    } else {
        await performLogin("demo@dronemind.ai", "demo123");
    }
};

window.registerNewUser = async function() {
    alert("New Delivery Partner registered successfully!\nLoading demo workspace for Cloud Kitchen...");
    await window.passwordlessLogin("USER");
};

async function handleLoginSubmit(event) {
    event.preventDefault();
}

async function performLogin(email, password) {
    const errDiv = document.getElementById("login-error");
    errDiv.style.display = "none";

    try {
        const res = await api.login(email, password);
        currentSession.user = res.user;
        currentSession.role = res.user.role;
        currentSession.token = res.token;
        currentSession.organization_id = res.user.organization_id;
        
        // Match org name
        if (res.user.role === "ADMIN") {
            currentSession.org_name = "Platform Administrator";
        } else if (res.user.organization_id === "org_cloud_kitchen") {
            currentSession.org_name = "Cloud Kitchen";
        } else if (res.user.organization_id === "org_mediexpress") {
            currentSession.org_name = "MediExpress";
        } else if (res.user.organization_id === "org_quickcart") {
            currentSession.org_name = "QuickCart Logistics";
        } else {
            currentSession.org_name = "Organization Tenant";
        }

        localStorage.setItem("dronemind_session", JSON.stringify(currentSession));
        initAuthenticatedSession();

    } catch (err) {
        errDiv.innerText = err.message || "Invalid credentials.";
        errDiv.style.display = "block";
    }
}

function handleLogout() {
    localStorage.removeItem("dronemind_session");
    currentSession = { user: null, role: null, token: null, organization_id: null, org_name: null };
    if (map) { map.remove(); map = null; }
    showLoginOverlay();
}

function initAuthenticatedSession() {
    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("main-app").style.display = "flex";

    // Set UI session labels
    document.getElementById("session-user-email").innerText = currentSession.user.email;
    document.getElementById("session-org-badge").innerText = currentSession.org_name;

    const roleBadge = document.getElementById("role-mode-indicator");
    const navTitle = document.getElementById("top-nav-title");
    const navSub = document.getElementById("top-nav-subtitle");
    const tagLine = document.getElementById("sidebar-role-tagline");

    if (currentSession.role === "ADMIN") {
        roleBadge.innerText = "ADMIN MODE";
        roleBadge.style.background = "rgba(0, 240, 255, 0.15)";
        roleBadge.style.borderColor = "#00f0ff";
        roleBadge.style.color = "#00f0ff";
        navTitle.innerText = "DRONEMIND ADMIN COMMAND CENTER";
        navSub.innerText = "Platform-wide Multi-Tenant Governance";
        tagLine.innerText = "GLOBAL GOVERNANCE";

        renderSidebarLinks("ADMIN");
        switchView("admin-overview");
        loadAdminData();
    } else {
        roleBadge.innerText = `BUSINESS MODE — ${currentSession.org_name.toUpperCase()}`;
        roleBadge.style.background = "rgba(0, 255, 102, 0.15)";
        roleBadge.style.borderColor = "#00ff66";
        roleBadge.style.color = "#00ff66";
        navTitle.innerText = `COMMAND CENTER — ${currentSession.org_name.toUpperCase()}`;
        navSub.innerText = "Organization Fleet Intelligence & Optimization";
        tagLine.innerText = `${currentSession.org_name.toUpperCase()}`;

        if (document.getElementById("user-fleet-org-badge")) {
            document.getElementById("user-fleet-org-badge").innerText = currentSession.org_name;
        }

        renderSidebarLinks("USER");
        switchView("overview");
        loadUserData();
    }
}

function renderSidebarLinks(role) {
    const ul = document.getElementById("sidebar-links");
    ul.innerHTML = "";

    if (role === "ADMIN") {
        const links = [
            { id: "admin-overview", label: "Overview" },
            { id: "admin-orgs", label: "Organizations" },
            { id: "admin-fleet", label: "Global Fleet" },
            { id: "admin-missions", label: "Global Missions" },
            { id: "live-map", label: "Global Map" },
            { id: "admin-analytics", label: "Analytics" },
            { id: "admin-alerts", label: "System Alerts" },
        ];
        links.forEach(l => {
            const li = document.createElement("li");
            li.setAttribute("data-target", l.id);
            li.innerText = l.label;
            li.onclick = () => switchView(l.id);
            ul.appendChild(li);
        });
    } else {
        const links = [
            { id: "overview", label: "Overview" },
            { id: "fleet", label: "My Fleet" },
            { id: "missions", label: "Delivery Orders" },
            { id: "optimization", label: "Optimization Center" },
            { id: "simulation", label: "Simulation" },
            { id: "live-map", label: "Live Map" },
            { id: "schedule", label: "Schedule" },
        ];
        links.forEach(l => {
            const li = document.createElement("li");
            li.setAttribute("data-target", l.id);
            li.innerText = l.label;
            li.onclick = () => switchView(l.id);
            ul.appendChild(li);
        });
    }
}

function switchView(viewId) {
    const links = document.querySelectorAll('#sidebar-links li');
    const sections = document.querySelectorAll('.view-section');

    links.forEach(l => {
        if (l.getAttribute('data-target') === viewId) l.classList.add('active');
        else l.classList.remove('active');
    });

    sections.forEach(s => {
        if (s.id === viewId) s.classList.add('active');
        else s.classList.remove('active');
    });

    if (viewId === 'live-map') {
        setTimeout(initMap, 100);
    }
}

// ================= ADMIN DATA & RENDERERS =================
async function loadAdminData() {
    try {
        state.organizations = await api.getAdminOrganizations();
        state.drones = await api.getAdminDrones("ALL");
        state.missions = await api.getAdminMissions("ALL");
        state.alerts = await api.getAdminAlerts("ALL");
        state.analytics = await api.getAdminAnalytics();

        renderAdminOverview();
        renderAdminOrgsTable();
        renderAdminFleetTable();
        renderAdminMissionsTable();
        renderAdminAnalyticsCharts();
        renderAdminAlertsTable();
    } catch (e) {
        console.error("Admin data load error:", e);
    }
}

function renderAdminOverview() {
    if (!state.analytics) return;
    const a = state.analytics;

    document.getElementById("admin-stat-orgs").innerText = a.total_organizations;
    document.getElementById("admin-stat-drones").innerText = a.total_drones;
    document.getElementById("admin-stat-missions").innerText = a.total_missions;
    document.getElementById("admin-stat-emergencies").innerText = a.emergency_missions;

    document.getElementById("admin-stat-util-total").innerText = a.total_drones;
    document.getElementById("admin-stat-util-avail").innerText = a.active_drones;
    document.getElementById("admin-stat-util-maint").innerText = a.maintenance + a.charging;
    document.getElementById("admin-stat-util-pct").innerText = `${a.fleet_utilization_pct}%`;

    // Render Org Summary Table
    const tbody = document.getElementById("admin-org-summary-table");
    tbody.innerHTML = state.organizations.map(o => {
        const orgDrones = state.drones.filter(d => d.organization_id === o.id).length;
        const orgMissions = state.missions.filter(m => m.organization_id === o.id && m.status === 'Active').length;
        return `
            <tr>
                <td><strong>${o.name}</strong></td>
                <td>${o.business_type}</td>
                <td class="text-cyan">${orgDrones}</td>
                <td class="text-orange">${orgMissions}</td>
                <td><span class="text-green">&bull; ${o.status}</span></td>
            </tr>
        `;
    }).join("");

    // Admin Alerts list
    const alertsList = document.getElementById("admin-alerts-list");
    alertsList.innerHTML = state.alerts.map(alt => `
        <li><span class="${alt.severity === 'critical' ? 'text-red' : alt.severity === 'warning' ? 'text-orange' : 'text-cyan'}">[${alt.timestamp}]</span> <strong>[${alt.organization_id}]</strong> ${alt.message}</li>
    `).join("");
}

function renderAdminOrgsTable() {
    const tbody = document.querySelector("#admin-organizations-table tbody");
    tbody.innerHTML = state.organizations.map(o => {
        const orgDrones = state.drones.filter(d => d.organization_id === o.id).length;
        return `
            <tr>
                <td><strong>${o.id}</strong></td>
                <td><strong>${o.name}</strong></td>
                <td>${o.business_type}</td>
                <td>${o.user_count} Users</td>
                <td class="text-cyan">${orgDrones} Drones</td>
                <td><span class="text-green">&bull; ${o.status}</span></td>
                <td>${o.created_at}</td>
                <td>
                    <button class="btn primary-btn" style="padding: 2px 8px; font-size:10px;" onclick="openOrgDetailModal('${o.id}')">TELEMETRY ↵</button>
                </td>
            </tr>
        `;
    }).join("");
}

window.openOrgDetailModal = function(orgId) {
    const org = state.organizations.find(o => o.id === orgId);
    if (!org) return;

    const orgDrones = state.drones.filter(d => d.organization_id === orgId);
    const orgMissions = state.missions.filter(m => m.organization_id === orgId);

    document.getElementById("org-modal-title").innerText = `ORGANIZATION TELEMETRY: ${org.name.toUpperCase()}`;
    document.getElementById("org-modal-body").innerHTML = `
        <div style="font-size: 13px;">
            <p><strong>Business Category:</strong> ${org.business_type}</p>
            <p><strong>Status:</strong> <span class="text-green">${org.status}</span></p>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
            <h4 class="text-cyan">Fleet Composition (${orgDrones.length} Drones)</h4>
            <div style="max-height: 150px; overflow-y: auto;" class="mt-1">
                <table class="data-table">
                    <thead><tr><th>Drone</th><th>Status</th><th>Battery</th></tr></thead>
                    <tbody>
                        ${orgDrones.map(d => `<tr><td>${d.id}</td><td>${d.status}</td><td class="text-cyan">${d.battery}%</td></tr>`).join("")}
                    </tbody>
                </table>
            </div>
            <h4 class="text-orange mt-2">Active Missions (${orgMissions.length})</h4>
            <div style="max-height: 150px; overflow-y: auto;" class="mt-1">
                <table class="data-table">
                    <thead><tr><th>Mission</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>
                        ${orgMissions.map(m => `<tr><td>${m.id}</td><td class="text-red">${m.priority}</td><td>${m.status}</td></tr>`).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById("org-detail-modal").style.display = "flex";
};

async function loadAdminFleet() {
    const orgSelect = document.getElementById("admin-fleet-org-select").value;
    state.drones = await api.getAdminDrones(orgSelect);
    renderAdminFleetTable();
}

function renderAdminFleetTable() {
    const tbody = document.querySelector("#admin-fleet-table tbody");
    tbody.innerHTML = state.drones.map(d => `
        <tr>
            <td><strong class="text-cyan">${d.organization_id || 'org_cloud_kitchen'}</strong></td>
            <td><strong>${d.id}</strong></td>
            <td>${d.status}</td>
            <td class="${d.battery < 30 ? 'text-red' : d.battery < 60 ? 'text-orange' : 'text-green'}">${d.battery}%</td>
            <td>${d.range} km</td>
            <td>${d.payload} kg</td>
            <td>${d.health}%</td>
            <td>${d.current_mission || '-'}</td>
        </tr>
    `).join("");
}

async function loadAdminMissions() {
    const orgSelect = document.getElementById("admin-mission-org-select").value;
    state.missions = await api.getAdminMissions(orgSelect);
    renderAdminMissionsTable();
}

function renderAdminMissionsTable() {
    const tbody = document.querySelector("#admin-missions-table tbody");
    tbody.innerHTML = state.missions.map(m => `
        <tr>
            <td><strong class="text-cyan">${m.organization_id || 'org_cloud_kitchen'}</strong></td>
            <td><strong>${m.id}</strong></td>
            <td>${m.type}</td>
            <td class="${m.priority === 'Emergency' ? 'text-red' : m.priority === 'High' ? 'text-orange' : 'text-cyan'}">${m.priority}</td>
            <td>${m.deadline}</td>
            <td>${m.distance} km</td>
            <td>${m.status}</td>
            <td>${m.assigned_drone || '-'}</td>
        </tr>
    `).join("");
}

function renderAdminAnalyticsCharts() {
    const ctx1 = document.getElementById('adminOrgFleetChart');
    if (adminFleetChart) adminFleetChart.destroy();

    const orgFleetCounts = state.organizations.map(o => {
        return state.drones.filter(d => d.organization_id === o.id).length;
    });

    adminFleetChart = new Chart(ctx1, {
        type: 'pie',
        data: {
            labels: state.organizations.map(o => o.name),
            datasets: [{
                data: orgFleetCounts,
                backgroundColor: ['#00f0ff', '#00ff66', '#ff9900'],
                borderColor: '#12192b'
            }]
        },
        options: { plugins: { legend: { labels: { color: '#e2e8f0' } } } }
    });

    const ctx2 = document.getElementById('adminOrgMissionChart');
    if (adminMissionChart) adminMissionChart.destroy();

    const orgMissionCounts = state.organizations.map(o => {
        return state.missions.filter(m => m.organization_id === o.id).length;
    });

    adminMissionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: state.organizations.map(o => o.name),
            datasets: [{
                label: 'Total Missions',
                data: orgMissionCounts,
                backgroundColor: '#00f0ff'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { color: '#e2e8f0' } }, x: { ticks: { color: '#e2e8f0' } } }
        }
    });
}

function renderAdminAlertsTable() {
    const tbody = document.querySelector("#admin-alerts-table tbody");
    tbody.innerHTML = state.alerts.map(a => `
        <tr>
            <td><strong>${a.id}</strong></td>
            <td><strong class="text-cyan">${a.organization_id}</strong></td>
            <td>${a.message}</td>
            <td><span class="${a.severity === 'critical' ? 'text-red' : a.severity === 'warning' ? 'text-orange' : 'text-cyan'}">${a.severity.toUpperCase()}</span></td>
            <td>${a.alert_type}</td>
            <td>${a.timestamp}</td>
        </tr>
    `).join("");
}


// ================= USER / BUSINESS DATA & RENDERERS =================
async function loadUserData() {
    const orgId = currentSession.organization_id;
    try {
        state.drones = await api.getDrones(orgId);
        state.missions = await api.getMissions(orgId);
        populateSimDropdowns();

        renderDashboard();
        renderFleet();
        renderMissions();
    } catch (e) {
        logAlert("Failed to load organization data.", "text-red");
    }
}

function logAlert(msg, colorClass="text-cyan") {
    const list = document.getElementById("alerts-list");
    if (!list) return;
    const li = document.createElement("li");
    li.innerHTML = `<span class="${colorClass}">[sys]</span> ${msg}`;
    list.prepend(li);
    if (list.children.length > 5) list.lastChild.remove();
}

function renderDashboard() {
    const totalDrones = state.drones.length;
    const avail = state.drones.filter(d => d.status === 'Available').length;
    const onMission = state.drones.filter(d => d.status === 'On Mission').length;
    const operational = state.drones.filter(d => d.status !== 'Maintenance' && d.health > 0).length;
    const critical = state.drones.filter(d => d.battery < 30).length;

    document.getElementById("stat-total-drones").innerText = totalDrones;
    document.getElementById("stat-available-drones").innerText = avail;
    document.getElementById("stat-mission-drones").innerText = onMission;
    document.getElementById("stat-active-missions").innerText = state.missions.filter(m => m.status === 'Active' || m.status === 'Pending').length;

    if(document.getElementById("stat-fleet-avail")) {
        document.getElementById("stat-fleet-avail").innerText = `${avail} / ${totalDrones}`;
        document.getElementById("stat-fleet-op").innerText = `${operational} / ${totalDrones}`;
        document.getElementById("stat-fleet-crit").innerText = critical;
    }

    if(document.getElementById("stat-opt-time")) {
        document.getElementById("stat-opt-time").innerText = optStats.time;
        document.getElementById("stat-opt-total").innerText = optStats.total;
        document.getElementById("stat-opt-feasible").innerText = optStats.feasible;
        document.getElementById("stat-opt-reassigned").innerText = optStats.reassigned;
        document.getElementById("stat-opt-unassigned").innerText = optStats.unassigned;
    }

    renderCharts();
}

function renderCharts() {
    const ctx1 = document.getElementById('fleetChart');
    if(!ctx1) return;
    if(fleetChart) fleetChart.destroy();
    
    const statuses = state.drones.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
    }, {});
    
    fleetChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statuses),
            datasets: [{
                data: Object.values(statuses),
                backgroundColor: ['#00f0ff', '#ff9900', '#ff3333', '#64748b'],
                borderWidth: 1,
                borderColor: '#12192b'
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#e2e8f0' } } }
        }
    });

    const ctx2 = document.getElementById('missionPriorityChart');
    if(!ctx2) return;
    if(priorityChart) priorityChart.destroy();
    
    const priorities = state.missions.reduce((acc, m) => {
        acc[m.priority] = (acc[m.priority] || 0) + 1;
        return acc;
    }, {});
    
    priorityChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: Object.keys(priorities),
            datasets: [{
                label: 'Delivery Orders',
                data: Object.values(priorities),
                backgroundColor: '#00f0ff'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { color: '#e2e8f0' } },
                x: { ticks: { color: '#e2e8f0' } }
            }
        }
    });
}

function renderFleet() {
    const tbody = document.querySelector("#fleet-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    state.drones.forEach(d => {
        const tr = document.createElement("tr");
        let batteryColor = "text-green";
        if (d.battery < 60) batteryColor = "text-orange";
        if (d.battery < 30) batteryColor = "text-red";
        
        tr.innerHTML = `
            <td><strong>${d.id}</strong></td>
            <td>${d.status}</td>
            <td class="${batteryColor}">${d.battery}%</td>
            <td>${d.range} km</td>
            <td>${d.payload} kg</td>
            <td>${d.health}%</td>
            <td>${d.current_mission || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMissions() {
    const tbody = document.querySelector("#missions-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    state.missions.forEach(m => {
        const tr = document.createElement("tr");
        let priorityColor = "text-cyan";
        if(m.priority === 'Emergency') priorityColor = 'text-red';
        if(m.priority === 'High') priorityColor = 'text-orange';
        
        tr.innerHTML = `
            <td><strong>${m.id}</strong></td>
            <td>${m.type}</td>
            <td class="${priorityColor}">${m.priority}</td>
            <td>${m.deadline}</td>
            <td>${m.distance} km</td>
            <td>${m.status}</td>
            <td>${m.assigned_drone || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function logSim(msg) {
    const box = document.getElementById("simulation-log");
    if (!box) return;
    box.innerHTML += `<div>> ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
}

function populateSimDropdowns() {
    const droneSel = document.getElementById("sim-fail-drone-select");
    const batSel = document.getElementById("sim-bat-drone-select");
    if (!droneSel || !batSel) return;

    const dronesHtml = state.drones.map(d => `<option value="${d.id}">${d.id} (${d.status})</option>`).join("");
    droneSel.innerHTML = dronesHtml;
    batSel.innerHTML = dronesHtml;
}

async function handleRunOptimization() {
    const terminal = document.getElementById("optimization-terminal");
    const assignmentsPanel = document.getElementById("assignments-panel");
    const rejectedPanel = document.getElementById("rejected-panel");
    
    terminal.innerHTML = `<div class="terminal-text">> Initiating organization optimization sequence...</div>`;
    
    const steps = [
        `> Scoping operational assets to ${currentSession.org_name || 'Organization'}...`,
        "> Checking battery margin & capacity constraints...",
        "> Validating payload compatibility...",
        "> Computing expected deadline priority factors...",
        "> Generating 100-point deterministic assignment score matrix..."
    ];
    
    for (let i=0; i<steps.length; i++) {
        await new Promise(r => setTimeout(r, 500));
        terminal.innerHTML += `<div class="terminal-text">${steps[i]}</div>`;
    }

    try {
        const res = await api.runOptimization(currentSession.organization_id);
        
        terminal.innerHTML += `<div class="terminal-text text-green">> OPTIMIZATION COMPLETED SUCCESSFULLY.</div>`;
        
        assignmentsPanel.style.display = "block";
        const aList = document.getElementById("assigned-list");
        aList.innerHTML = res.assignments.map(a => `
            <tr class="assignment-item hover-highlight cursor-pointer" onclick='openDecisionModal(${JSON.stringify(a).replace(/'/g, "&apos;")})'>
                <td><strong>${a.mission}</strong></td>
                <td><strong>${a.assigned_drone}</strong></td>
                <td class="text-cyan">${a.feasibility_score.toFixed(1)}/100</td>
                <td class="${a.battery_after_mission < 30 ? 'text-orange' : 'text-green'}">${a.battery_after_mission}%</td>
                <td>${a.distance} km</td>
                <td class="text-muted" style="font-size: 11px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.reason}">${a.reason}</td>
            </tr>
        `).join("");
        
        if (res.rejected.length > 0) {
            rejectedPanel.style.display = "block";
            const rList = document.getElementById("rejection-list");
            rList.innerHTML = res.rejected.map(r => `
                <tr>
                    <td>${r.drone}</td>
                    <td>${r.mission}</td>
                    <td class="text-red" style="font-size: 11px;">${r.reason}</td>
                </tr>
            `).join("");
        }

        optStats.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        optStats.total = state.missions.length;
        optStats.feasible = res.assignments.length;
        
        let reassignedCount = 0;
        res.assignments.forEach(a => {
            const m = state.missions.find(mi => mi.id === a.mission);
            const d = state.drones.find(dr => dr.id === a.assigned_drone);
            if (m) { 
                if (m.assigned_drone && m.assigned_drone !== a.assigned_drone) reassignedCount++;
                m.assigned_drone = d.id; 
                m.status = "Active"; 
            }
            if (d) { d.status = "On Mission"; d.current_mission = m.id; d.battery = a.battery_after_mission; }
        });
        
        optStats.reassigned = reassignedCount;
        optStats.unassigned = res.rejected.length > 0 ? Array.from(new Set(res.rejected.map(r => r.mission))).length : 0;

        renderDashboard();
        renderFleet();
        renderMissions();
        logAlert("Optimization applied. Organization assets deployed.");
        
    } catch(e) {
        terminal.innerHTML += `<div class="terminal-text text-red">> OPTIMIZATION FAILED: SERVER ERROR.</div>`;
    }
}

window.openDecisionModal = function(a) {
    document.getElementById("decision-modal-title").innerText = `WHY WAS ${a.assigned_drone} SELECTED?`;
    document.getElementById("score-bat").innerText = `${a.score_breakdown.battery.toFixed(1)}/30`;
    document.getElementById("score-dist").innerText = `${a.score_breakdown.distance.toFixed(1)}/25`;
    document.getElementById("score-dead").innerText = `${a.score_breakdown.deadline.toFixed(1)}/20`;
    document.getElementById("score-pay").innerText = `${a.score_breakdown.payload.toFixed(1)}/25`;
    document.getElementById("score-total").innerText = `${a.score_breakdown.total.toFixed(1)}/100`;
    
    document.getElementById("decision-modal").style.display = "flex";
    highlightRoute(a.assigned_drone);
};

window.highlightRoute = function(droneId) {
    if(!map) return;
    mapMarkers.forEach(m => {
        if(m instanceof L.Polyline) {
            m.setStyle({weight: 2, opacity: 0.4, color: 'rgba(0, 240, 255, 0.4)', dashArray: '5, 5'});
        }
    });

    const drone = state.drones.find(d => d.id === droneId);
    if(drone && drone._leafletLine) {
        drone._leafletLine.setStyle({weight: 5, opacity: 1, color: '#00ff66', dashArray: null});
        if(drone._leafletLine.bringToFront) drone._leafletLine.bringToFront();
    }
};

async function simulateFailure() {
    const droneId = document.getElementById("sim-fail-drone-select").value;
    logSim(`Simulating failure for ${droneId}...`);
    
    const affectedMission = state.missions.find(m => m.assigned_drone === droneId);
    
    try {
        await api.simulateFailure(droneId, currentSession.organization_id);
        logSim(`${droneId} OFFLINE. Marked as Maintenance.`);
        logAlert(`CRITICAL: ${droneId} failed. Re-optimization required!`, "text-red");
        await loadUserData();
        
        let affectedHtml = `<div class="text-red mt-2"><strong>${droneId} &rarr; FAILED (Maintenance)</strong></div>`;
        if (affectedMission) {
            affectedHtml += `<div class="text-orange">⚠ ${affectedMission.id} ASSIGNMENT INVALIDATED</div>
                             <div class="mt-1">AUTO RE-OPTIMIZING FLEET FOR REPLACEMENT...</div>`;
        }
        
        const card = document.getElementById("sim-fail-drone-select").parentElement;
        let affectedDiv = document.getElementById("sim-fail-affected");
        if (!affectedDiv) {
            affectedDiv = document.createElement("div");
            affectedDiv.id = "sim-fail-affected";
            card.appendChild(affectedDiv);
        }
        affectedDiv.innerHTML = affectedHtml;
        affectedDiv.style.display = "block";
        
        // Auto-trigger dynamic re-optimization
        await window.reoptimizeFleet('failure');
        
        renderDashboard();
        renderFleet();
    } catch(e) {
        logSim("API error during failure simulation.");
    }
}

async function simulateBatteryDrop() {
    const droneId = document.getElementById("sim-bat-drone-select").value;
    const newBat = document.getElementById("sim-bat-level").value;
    if(!newBat) return;
    
    logSim(`Warning: ${droneId} battery plunged to ${newBat}%.`);
    logAlert(`Warning: ${droneId} low battery.`, "text-orange");
    
    try {
        await api.simulateBatteryDrop(droneId, parseInt(newBat), currentSession.organization_id);
        await loadUserData();
        
        let affectedHtml = `<div class="text-orange mt-2"><strong>${droneId} &rarr; Battery Dropped to ${newBat}%</strong></div>`;
        
        const card = document.getElementById("sim-bat-drone-select").parentElement;
        let affectedDiv = document.getElementById("sim-bat-affected");
        if (!affectedDiv) {
            affectedDiv = document.createElement("div");
            affectedDiv.id = "sim-bat-affected";
            card.appendChild(affectedDiv);
        }
        affectedDiv.innerHTML = affectedHtml;
        affectedDiv.style.display = "block";
        
        await window.reoptimizeFleet('battery_drop');
        
        renderDashboard();
        renderFleet();
    } catch (e) {
        logSim("API error during battery drop simulation.");
    }
}

async function simulateEmergency() {
    logSim(`Requesting NEW EMERGENCY MISSION...`);
    try {
        const newM = await api.simulateEmergency(currentSession.organization_id);
        logSim(`INCOMING EMERGENCY MISSION: ${newM.id}`);
        logAlert(`EMERGENCY MISSION ${newM.id} created.`, "text-red");
        await loadUserData();
        renderMissions();
        renderDashboard();
        
        const card = document.querySelector(".emergency-btn").parentElement;
        let emgDiv = document.getElementById("sim-emg-affected");
        if (!emgDiv) {
            emgDiv = document.createElement("div");
            emgDiv.id = "sim-emg-affected";
            card.appendChild(emgDiv);
        }
        emgDiv.innerHTML = `
            <div class="text-red mt-2">🚨 EMERGENCY MISSION CREATED</div>
            <div class="text-orange mt-1">Existing fleet schedule requires re-optimization.</div>
        `;
        emgDiv.style.display = "block";
        
        let reoptBtn = document.getElementById("sim-reoptimize-emg");
        if (!reoptBtn) {
            reoptBtn = document.createElement("button");
            reoptBtn.id = "sim-reoptimize-emg";
            reoptBtn.className = "btn massive-btn mt-2";
            reoptBtn.innerText = "RE-OPTIMIZE FLEET";
            reoptBtn.onclick = () => window.reoptimizeFleet('emergency');
            card.appendChild(reoptBtn);
        }
        reoptBtn.style.display = "block";
        
    } catch(e) {
        logSim("API error during emergency simulation.");
    }
}

window.reoptimizeFleet = async function(context) {
    logSim("RE-OPTIMIZING FLEET...");
    try {
        const oldAssignments = {};
        state.missions.forEach(m => { if(m.assigned_drone) oldAssignments[m.id] = m.assigned_drone; });
        
        const res = await api.runOptimization(currentSession.organization_id);
        
        let changesHtml = `<h4 class="mt-2 text-cyan">CHANGED ASSIGNMENTS</h4><ul class="data-list" style="font-size:12px;">`;
        let changesCount = 0;
        
        res.assignments.forEach(a => {
            const oldDrone = oldAssignments[a.mission];
            if (oldDrone !== a.assigned_drone) {
                changesCount++;
                if (oldDrone) {
                    changesHtml += `<li>${a.mission}: <span class="text-muted text-decoration-line-through">${oldDrone}</span> &rarr; <span class="text-green">${a.assigned_drone}</span></li>`;
                } else {
                    changesHtml += `<li><span class="text-red">NEW</span> ${a.mission} &rarr; <span class="text-green">${a.assigned_drone}</span></li>`;
                }
            }
        });
        
        if(changesCount === 0) changesHtml += `<li>No reassignments needed.</li>`;
        changesHtml += `</ul>`;
        
        if(context === 'failure') {
            document.getElementById("sim-fail-affected").innerHTML += changesHtml;
            document.getElementById("sim-reoptimize-fail").style.display = "none";
        } else if (context === 'emergency') {
            document.getElementById("sim-emg-affected").innerHTML += changesHtml;
            document.getElementById("sim-reoptimize-emg").style.display = "none";
        } else if (context === 'battery_drop') {
            document.getElementById("sim-bat-affected").innerHTML += changesHtml;
        }
        
        // Apply
        res.assignments.forEach(a => {
            const m = state.missions.find(mi => mi.id === a.mission);
            const d = state.drones.find(dr => dr.id === a.assigned_drone);
            if (m && d) {
                m.assigned_drone = d.id;
                m.status = "Active";
                d.status = "On Mission";
                d.current_mission = m.id;
                d.battery = a.battery_after_mission;
            }
        });
        
        renderDashboard();
        renderFleet();
        renderMissions();
        if(map) { drawMapEntities(); }
        
        logAlert("Re-optimization complete.", "text-green");
    } catch (e) {
        logSim("API error during re-optimization: " + e.message);
        console.error("Re-optimization error:", e);
    }
};

window.openCreateMissionModal = function() {
    document.getElementById("create-mission-modal").style.display = "flex";
    document.getElementById("new-mission-distance").value = "";
    document.getElementById("new-mission-payload").value = "";
};

window.submitNewMission = function(event) {
    event.preventDefault();
    const type = document.getElementById("new-mission-type").value;
    const priority = document.getElementById("new-mission-priority").value;
    const distance = parseFloat(document.getElementById("new-mission-distance").value);
    const payload = parseFloat(document.getElementById("new-mission-payload").value);

    const nextNum = state.missions.length + 1;
    const mId = `M-${String(nextNum).padStart(3, '0')}`;
    
    // Create new mission locally 
    const newMission = {
        id: mId,
        organization_id: currentSession.organization_id,
        type: type,
        priority: priority,
        deadline: priority === 'Emergency' ? 'Immediate' : 'Standard',
        distance: distance,
        payload_req: payload,
        status: "Pending",
        assigned_drone: null,
        location: [28.6300 + (Math.random()-0.5)*0.02, 77.2150 + (Math.random()-0.5)*0.02]
    };

    state.missions.push(newMission);
    document.getElementById("create-mission-modal").style.display = "none";
    
    logAlert(`New Delivery Order ${mId} added to queue. Optimization required.`, "text-cyan");
    
    renderMissions();
    renderDashboard();
    
    if (map) {
        // Redraw map with the new unassigned mission
        drawMapEntities();
    }
};

function initMap() {
    if (map) return;
    const mapEl = document.getElementById('map');
    if(!mapEl || mapEl.clientWidth === 0) return;
    
    map = L.map('map').setView([28.6300, 77.2150], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    drawMapEntities();
}

function drawMapEntities() {
    if(!map) return;
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];
    
    let placedLocs = [];
    function getSpacedLoc(orig) {
        let loc = [orig[0], orig[1]];
        let tries = 0;
        while(tries < 10 && placedLocs.some(p => Math.abs(p[0] - loc[0]) < 0.002 && Math.abs(p[1] - loc[1]) < 0.002)) {
            loc[0] += (Math.random() - 0.5) * 0.005;
            loc[1] += (Math.random() - 0.5) * 0.005;
            tries++;
        }
        placedLocs.push(loc);
        return loc;
    }
    
    state.drones.forEach(d => { d._mapLoc = getSpacedLoc(d.location); });
    state.missions.forEach(m => { m._mapLoc = getSpacedLoc(m.location); });
    
    state.drones.forEach(d => {
        let color = d.status === 'Available' ? 'cyan' : d.status === 'On Mission' ? 'orange' : 'gray';
        const marker = L.circleMarker(d._mapLoc, {
            color: color, fillOpacity: 0.8, radius: 6
        }).addTo(map).bindPopup(`<b>${d.id}</b> (${d.organization_id || 'org'})<br>Bat: ${d.battery}%<br>${d.status}`);
        
        d._leafletMarker = marker;
        mapMarkers.push(marker);
        
        if (d.current_mission) {
            const m = state.missions.find(mi => mi.id === d.current_mission);
            if (m && m._mapLoc) {
                const line = L.polyline([d._mapLoc, m._mapLoc], {color: 'rgba(0, 240, 255, 0.4)', dashArray: '5, 5'}).addTo(map);
                d._leafletLine = line;
                mapMarkers.push(line);
            }
        }
    });
    
    state.missions.forEach(m => {
        if(m.status === 'Completed') return;
        let color = 'white';
        if (m.priority === 'Emergency') color = 'red';
        else if (m.priority === 'High') color = 'orange';
        
        const marker = L.circleMarker(m._mapLoc, {
            color: color, fillOpacity: 0.5, radius: 4, fillColor: color
        }).addTo(map).bindPopup(`<b>${m.id}</b> (${m.organization_id || 'org'})<br>${m.type}<br>Prio: ${m.priority}`);
        
        m._leafletMarker = marker;
        mapMarkers.push(marker);
    });
}
