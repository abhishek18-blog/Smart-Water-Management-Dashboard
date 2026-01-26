// --- 1. IMPORTS ---
import './style.css'; 
import { auth } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// --- 2. AUTHENTICATION LOGIC ---
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const emailInput = document.getElementById('emailInput');
const passInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

function setAuthLoading(isLoading) {
    const btns = [btnLogin, btnRegister];
    btns.forEach(btn => {
        if (isLoading) {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.innerText = "PROCESSING...";
        } else {
            btn.disabled = false;
            btn.style.opacity = "1";
            btnLogin.innerText = "AUTHENTICATE";
            btnRegister.innerText = "NEW ID";
        }
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        setTimeout(() => {
            dashboardSection.classList.remove('opacity-0');
        }, 100);
        enterDashboard();
    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        dashboardSection.classList.add('opacity-0');
    }
});

btnLogin.addEventListener('click', async () => {
    setAuthLoading(true);
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
        authError.classList.add('hidden');
    } catch (error) {
        authError.innerText = "Access Denied: " + error.message;
        authError.classList.remove('hidden');
    } finally {
        setAuthLoading(false);
    }
});

btnRegister.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passInput.value;
    if (!email.includes('@')) {
        authError.innerText = "Error: Use a valid email format.";
        authError.classList.remove('hidden');
        return;
    }
    setAuthLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        authError.classList.add('hidden');
    } catch (error) {
        authError.innerText = "Registration Failed: " + error.message;
        authError.classList.remove('hidden');
    } finally {
        setAuthLoading(false);
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth);
});

// --- 3. DASHBOARD LOGIC ---
let API_URL = ""; 
let globalData = [];      
let uniqueDevices = [];   
let currentDevice = null; 
let fetchInterval = null;

function enterDashboard() {
    const inputUrl = document.getElementById('ngrokUrl').value;
    if(!inputUrl) return; 
    
    API_URL = inputUrl.replace(/\/$/, ""); 
    startLiveClock();
    
    if (fetchInterval) clearInterval(fetchInterval);
    fetchData();
    fetchInterval = setInterval(fetchData, 2000); 

    const select = document.getElementById('deviceSelect');
    select.addEventListener('change', handleDeviceChange);
}

// FIXED: Bulletproof Time Formatter
function getCorrectedDateTime(dateInput) {
    if (!dateInput) return "--/-- --:--";

    let dateObj;
    if (typeof dateInput === 'string') {
        // Standardizes "YYYY-MM-DD HH:MM:SS" to ISO format
        const safeDate = dateInput.includes('T') ? dateInput : dateInput.replace(" ", "T");
        dateObj = new Date(safeDate);
    } else {
        dateObj = new Date(dateInput);
    }

    if (isNaN(dateObj.getTime())) return "Invalid Time";

    // Correction for IST offset (Subtracting 5.5 hours to align with server/local mismatch)
    const fixedTime = dateObj.getTime() - (5.5 * 60 * 60 * 1000); 
    
    return new Date(fixedTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' 
    });
}

function getCorrectedDateObject(dateInput) {
    if (!dateInput) return new Date();
    let dateObj;
    if (typeof dateInput === 'string') {
        const safeDate = dateInput.includes('T') ? dateInput : dateInput.replace(" ", "T");
        dateObj = new Date(safeDate);
    } else {
        dateObj = new Date(dateInput);
    }
    if (isNaN(dateObj.getTime())) return new Date();
    const fixedTime = dateObj.getTime() - (5.5 * 60 * 60 * 1000);
    return new Date(fixedTime);
}

function startLiveClock() {
    function update() {
        const now = new Date();
        const datePart = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
        const timePart = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        const clockEl = document.getElementById('liveClock');
        if(clockEl) clockEl.innerHTML = `<span class="text-cyan-500/80">${datePart}</span> • ${timePart}`;
    }
    update(); 
    setInterval(update, 1000); 
}

async function fetchData() {
    try {
        const response = await fetch(`${API_URL}/api/history`, {
            headers: { "ngrok-skip-browser-warning": "true", "Content-Type": "application/json" }
        });
        if (!response.ok) throw new Error("Offline");
        globalData = await response.json();
        
        if(globalData && globalData.length > 0) {
            updateDeviceList(globalData);
            refreshView();
            const diagPanel = document.getElementById('diagnosticPanel');
            if (diagPanel) diagPanel.style.borderLeftColor = "#00f2ff";
        }
    } catch (error) {
        const diagStatus = document.getElementById('diagStatus');
        if(diagStatus) {
            diagStatus.innerText = "CONNECTION FAILURE";
            diagStatus.style.color = "#ff2a2a";
            const diagPanel = document.getElementById('diagnosticPanel');
            if (diagPanel) diagPanel.style.borderLeftColor = "#ff2a2a";
        }
    }
}

function updateDeviceList(data) {
    const foundDevices = [...new Set(data.map(item => item.valve_id))];
    if (JSON.stringify(foundDevices.sort()) !== JSON.stringify(uniqueDevices.sort())) {
        uniqueDevices = foundDevices;
        const select = document.getElementById('deviceSelect');
        const savedSelection = select.value;
        select.innerHTML = uniqueDevices.map(id => `<option value="${id}">${id}</option>`).join('');
        if (savedSelection && uniqueDevices.includes(savedSelection)) {
            select.value = savedSelection;
        } else if (uniqueDevices.length > 0) {
            select.value = uniqueDevices[0];
            currentDevice = uniqueDevices[0];
        }
    }
}

function handleDeviceChange() {
    const select = document.getElementById('deviceSelect');
    if (select) {
        currentDevice = select.value;
        refreshView();
    }
}

function refreshView() {
    if (!currentDevice || globalData.length === 0) return;
    const deviceHistory = globalData.filter(d => d.valve_id === currentDevice);
    if (deviceHistory.length > 0) {
        deviceHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        updateDashboard(deviceHistory);
    }
}

function updateDashboard(historyData) {
    const latest = historyData[0];
    const turns = latest.turns ?? latest.valve_turns ?? 0; 
    
    // Update Rotation Card
    const turnsEl = document.getElementById('valveTurns');
    if (turnsEl) turnsEl.innerText = turns;

    // Update Sync Card with fixed date logic
    const syncEl = document.getElementById('lastSync');
    if (syncEl) syncEl.innerText = getCorrectedDateTime(latest.created_at);

    runDiagnostics(turns, latest.valve_status); 
    processDailyStats(historyData);

    // Update Event Table (Removed Pressure references)
    const logBody = document.getElementById('logTableBody');
    if (logBody) {
        logBody.innerHTML = historyData.slice(0, 15).map(row => {
            let statusColor = "text-tech-success";
            const statusStr = row.valve_status || "Unknown";
            if (statusStr.includes("HIGH") || statusStr.includes("LEAK")) statusColor = "text-red-500";

            return `<tr class="hover:bg-cyan-500/10 border-b border-white/5">
                <td class="p-3 text-slate-500 font-mono">${getCorrectedDateTime(row.created_at)}</td>
                <td class="p-3 text-white">ID:${row.valve_id.slice(-5)}</td>
                <td class="p-3 text-right ${statusColor} font-bold uppercase">${statusStr}</td>
                <td class="p-3 text-right text-amber-400 font-mono">${row.turns ?? 0} TRN</td>
            </tr>`;
        }).join('');
    }
}

function runDiagnostics(turns, dbStatus) {
    const diagText = document.getElementById('diagStatus');
    const diagPanel = document.getElementById('diagnosticPanel');
    const diagSub = document.getElementById('diagSubStatus');

    let displayStatus = dbStatus || "IDLE";
    let color = "#00f2ff"; 

    if (turns > 0) {
        displayStatus = dbStatus || "FLOW DETECTED";
        color = "#10b981"; 
        if (diagSub) diagSub.classList.add('hidden');
    } else {
        if (diagSub) diagSub.classList.add('hidden');
    }

    if (diagText) {
        diagText.innerText = displayStatus;
        diagText.style.color = color;
        diagText.style.textShadow = `0 0 10px ${color}55`;
    }
    if (diagPanel) diagPanel.style.borderLeftColor = color;
}

function processDailyStats(logs) {
    const grouped = {};
    logs.forEach(log => {
        const dateKey = getCorrectedDateObject(log.created_at).toISOString().split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(log);
    });

    const todayKey = new Date().toISOString().split('T')[0];
    updateComplianceCard(grouped[todayKey] || []);

    const sortedDates = Object.keys(grouped).sort().reverse(); 
    let tableHtml = "";
    sortedDates.slice(0, 5).forEach(date => {
        const dayLogs = grouped[date];
        dayLogs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        const stats = calculateDayMetrics(dayLogs);
        
        let scoreColor = "text-red-500";
        if(stats.score >= 80) scoreColor = "text-tech-success";
        else if(stats.score >= 50) scoreColor = "text-tech-warn";

        tableHtml += `<tr class="hover:bg-cyan-500/10 transition-colors border-b border-white/5">
            <td class="p-3 text-white font-bold">${date}</td>
            <td class="p-3 text-right text-slate-400">${stats.startTime}</td>
            <td class="p-3 text-right text-white">${stats.durationStr}</td>
            <td class="p-3 text-center font-bold ${scoreColor}">${stats.score}%</td>
        </tr>`;
    });
    const dailyBody = document.getElementById('dailyStatsBody');
    if (dailyBody) dailyBody.innerHTML = tableHtml;
}

function calculateDayMetrics(dayLogs) {
    let activeLogs = dayLogs.filter(l => (l.turns || l.valve_turns || 0) > 0);
    if(activeLogs.length === 0) return { startTime: "--:--", durationStr: "0m", score: 0 };

    const startObj = getCorrectedDateObject(activeLogs[0].created_at);
    const startTimeStr = startObj.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: true});
    
    const durationMs = new Date(activeLogs[activeLogs.length - 1].created_at) - new Date(activeLogs[0].created_at);
    const durationMin = Math.max(Math.floor(durationMs / 60000), 1);
    
    const hour = startObj.getHours();
    let timeScore = (hour === 4) ? 50 : 10;
    let durationScore = Math.min((durationMin / 120) * 50, 50); 

    return { 
        startTime: startTimeStr, 
        durationStr: `${Math.floor(durationMin/60)}h ${durationMin%60}m`, 
        score: Math.floor(timeScore + durationScore) 
    };
}

function updateComplianceCard(todayLogs) {
    const metrics = calculateDayMetrics(todayLogs);
    
    const scoreEl = document.getElementById('complianceScore');
    const startEl = document.getElementById('startTimeDisplay');
    const durEl = document.getElementById('durationDisplay');
    const ring = document.getElementById('complianceRing');
    const statusEl = document.getElementById('scheduleStatus');

    if (scoreEl) scoreEl.innerText = metrics.score + "%";
    if (startEl) startEl.innerText = metrics.startTime;
    if (durEl) durEl.innerText = metrics.durationStr;

    let color = "#ef4444"; 
    let statusText = "NON-COMPLIANT";
    
    if (metrics.score >= 80) { color = "#10b981"; statusText = "SCHEDULE ADHERED"; }
    else if (metrics.score >= 50) { color = "#fbbf24"; statusText = "PARTIAL ADHERENCE"; }

    if (ring) {
        ring.style.setProperty('--score-color', color);
        ring.style.setProperty('--score-deg', `${(metrics.score / 100) * 360}deg`);
    }
    if (statusEl) statusEl.innerText = statusText;
}
