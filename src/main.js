// --- 1. IMPORTS (Crucial for styling) ---
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

// Helper to toggle loading state
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

// Watch for login status
onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        setTimeout(() => {
            dashboardSection.classList.remove('opacity-0');
            dashboardSection.classList.add('fade-enter');
        }, 100);
        enterDashboard();
    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        dashboardSection.classList.add('opacity-0');
    }
});

// Login Button
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

// Register Button
btnRegister.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passInput.value;

    if (!email.includes('@')) {
        authError.innerText = "Error: Please use a valid email format (e.g., op@valve.com)";
        authError.classList.remove('hidden');
        return;
    }

    if (password.length < 6) {
        authError.innerText = "Error: Passcode must be at least 6 characters.";
        authError.classList.remove('hidden');
        return;
    }

    setAuthLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        authError.classList.add('hidden');
        console.log("New ID Created Successfully");
    } catch (error) {
        authError.innerText = "Registration Failed: " + error.message;
        authError.classList.remove('hidden');
    } finally {
        setAuthLoading(false);
    }
});

// Logout Button
document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth);
});


// --- 3. DASHBOARD LOGIC (IST Corrected) ---
let API_URL = ""; 
let globalData = [];      
let uniqueDevices = [];   
let currentDevice = null; 
let fetchInterval = null;

function enterDashboard() {
    const inputUrl = document.getElementById('ngrokUrl').value;
    if(!inputUrl) {
        console.warn("No API Endpoint set");
        return; 
    }
    
    API_URL = inputUrl.replace(/\/$/, ""); 
    startLiveClock();
    
    if (fetchInterval) clearInterval(fetchInterval);
    fetchData();
    fetchInterval = setInterval(fetchData, 2000); 

    const select = document.getElementById('deviceSelect');
    select.addEventListener('change', handleDeviceChange);
}

function getCorrectedDateTime(dateString) {
    if (!dateString) return "--/-- --:--";
    let safeDate = dateString;
    if (typeof dateString === 'string' && !dateString.includes('T') && !dateString.includes('Z')) {
        safeDate = dateString.replace(" ", "T"); 
    }
    const dateObj = new Date(safeDate);
    if (isNaN(dateObj.getTime())) return "Invalid Time";
    const fixedTime = dateObj.getTime() - (5.5 * 60 * 60 * 1000); 
    return new Date(fixedTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' 
    });
}

function getCorrectedDateObject(dateString) {
    let safeDate = dateString;
    if (typeof dateString === 'string') safeDate = dateString.replace(" ", "T");
    const dateObj = new Date(safeDate);
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
        if (!response.ok) throw new Error("Server Offline: " + response.status);
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            globalData = await response.json();
        } else {
            throw new Error("Invalid Data Format");
        }
        
        if(globalData.length > 0) {
            updateDeviceList(globalData);
            refreshView();
            const diagText = document.getElementById('diagStatus');
            if (diagText && diagText.innerText === "CONNECTION FAILURE") {
                document.getElementById('diagnosticPanel').style.borderLeftColor = "#00f2ff";
            }
        }
    } catch (error) {
        console.error("Connection Error:", error);
        const diagText = document.getElementById('diagStatus');
        if(diagText) {
            diagText.innerText = "CONNECTION FAILURE";
            diagText.style.color = "#ff2a2a";
            document.getElementById('diagnosticPanel').style.borderLeftColor = "#ff2a2a";
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
            if(currentDevice !== savedSelection) currentDevice = savedSelection;
        } else if (uniqueDevices.length > 0) {
            select.value = uniqueDevices[0];
            currentDevice = uniqueDevices[0];
        }
    }
}

function handleDeviceChange() {
    const select = document.getElementById('deviceSelect');
    currentDevice = select.value;
    refreshView();
}

function refreshView() {
    if (!currentDevice || globalData.length === 0) return;
    const deviceHistory = globalData.filter(d => d.valve_id === currentDevice);
    if (deviceHistory.length > 0) {
        // Sort oldest to newest for sequence-based compliance logic, then update
        deviceHistory.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        updateDashboard(deviceHistory);
    }
}

function updateDashboard(historyData) {
    // Newest log for cards
    const sortedDesc = [...historyData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = sortedDesc[0]; 
    const pressure = latest.pressure_val || 0;
    const turns = latest.turns !== undefined ? latest.turns : (latest.valve_turns || 0); 
    
    // 1. Cards Update
    const pEl = document.getElementById('pressureVal');
    let pText = "LOW";
    let pClass = "text-slate-400"; 
    if (pressure > 2200) { pText = "HIGH"; pClass = "text-tech-alert"; } 
    else if (pressure > 800) { pText = "NORMAL"; pClass = "text-tech-success"; } 
    else { pText = "LOW"; pClass = (turns > 0) ? "text-tech-warn" : "text-slate-400"; }
    
    pEl.innerText = pText;
    pEl.className = `text-3xl font-mono font-bold leading-none tracking-wider ${pClass}`;
    
    document.getElementById('valveTurns').innerText = turns;
    const lastSyncEl = document.getElementById('lastSync');
    lastSyncEl.innerText = getCorrectedDateTime(latest.created_at);
    lastSyncEl.className = "text-xl font-mono font-bold text-white leading-none"; 
    
    const percentage = Math.min((pressure / 3000) * 100, 100);
    document.getElementById('pressureGauge').style.width = `${percentage}%`;

    runDiagnostics(pressure, turns, latest.valve_status); 
    processDailyStats(historyData);

    // 2. Table Update (Newest first)
    const tableHtml = sortedDesc.slice(0, 15).map(row => {
        let statusColor = "text-slate-500";
        const statusStr = row.valve_status || "Unknown";
        if (statusStr.includes("HIGH")) statusColor = "text-red-500";
        else if (statusStr.includes("FLOW")) statusColor = "text-tech-success";
        
        const rowTurns = row.turns !== undefined ? row.turns : (row.valve_turns || 0);

        return `<tr class="hover:bg-cyan-500/10 transition-colors border-b border-white/5">
            <td class="p-3 text-slate-500 text-[10px] font-mono">${getCorrectedDateTime(row.created_at)}</td>
            <td class="p-3 text-white font-medium">ID:${row.valve_id.slice(-5)}</td>
            <td class="p-3 text-right ${statusColor} font-bold uppercase text-[10px]">${statusStr}</td>
            <td class="p-3 text-right text-amber-400 font-bold font-mono">
                ${rowTurns} <span class="text-[8px] text-slate-600">TRN</span>
            </td>
        </tr>`
    }).join('');
    
    document.getElementById('logTableBody').innerHTML = tableHtml;
}

function runDiagnostics(pressure, turns, status) {
    let msg = "SYSTEM NOMINAL"; let color = "#00f2ff"; let icon = "fa-check-circle";
    const diagSub = document.getElementById('diagSubStatus');
    if (turns > 0 && pressure < 10) {
        msg = "GHOST FLOW DETECTED"; color = "#ff2a2a"; icon = "fa-burst";
        diagSub.classList.remove('hidden'); diagSub.innerText = "CRITICAL: Valve Open but Flow is Zero";
    } else if (pressure > 2500) {
        msg = "WARNING: HIGH PRESSURE"; color = "#fbbf24"; icon = "fa-exclamation-triangle";
        diagSub.classList.add('hidden');
    } else if (turns > 0 && pressure <= 800) {
        msg = "LOW PRESSURE WARNING"; color = "#fbbf24"; icon = "fa-arrow-down";
        diagSub.classList.remove('hidden'); diagSub.innerText = "Flow detected but pressure is suboptimal";
    } else {
        diagSub.classList.add('hidden');
    }
    const diagText = document.getElementById('diagStatus');
    const diagPanel = document.getElementById('diagnosticPanel');
    const iconBox = document.getElementById('diagIconBox');
    diagText.innerText = msg; diagText.style.color = color; diagText.style.textShadow = `0 0 10px ${color}55`;
    diagPanel.style.borderLeftColor = color;
    iconBox.style.color = color; iconBox.style.borderColor = color;
    iconBox.innerHTML = `<i class="fas ${icon}"></i>`;
}

function processDailyStats(logs) {
    const grouped = {};
    logs.forEach(log => {
        const correctedDate = getCorrectedDateObject(log.created_at);
        const y = correctedDate.getFullYear();
        const m = String(correctedDate.getMonth()+1).padStart(2,'0');
        const d = String(correctedDate.getDate()).padStart(2,'0');
        const dateKey = `${y}-${m}-${d}`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(log);
    });

    const todayDate = new Date();
    const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
    updateComplianceCard(grouped[todayKey] || []);

    const sortedDates = Object.keys(grouped).sort().reverse(); 
    let tableHtml = "";
    sortedDates.slice(0, 5).forEach(date => {
        const dayLogs = grouped[date];
        const stats = calculateDayMetrics(dayLogs);
        let scoreColor = stats.score >= 80 ? "text-tech-success" : (stats.score >= 50 ? "text-tech-warn" : "text-red-500");
        let avgPColor = stats.avgPressure > 800 ? "text-green-500" : "text-slate-500";

        tableHtml += `<tr class="hover:bg-cyan-500/10 transition-colors border-b border-white/5">
            <td class="p-3 text-white font-bold">${date}</td>
            <td class="p-3 text-right text-slate-400">${stats.startTime}</td>
            <td class="p-3 text-right text-white">${stats.durationStr}</td>
            <td class="p-3 text-center font-bold ${scoreColor}">${stats.score}%</td>
            <td class="p-3 text-center font-bold ${avgPColor}">${stats.avgPressure > 800 ? 'NORMAL' : 'LOW'}</td>
        </tr>`;
    });
    document.getElementById('dailyStatsBody').innerHTML = tableHtml;
}

/**
 * INTEGRATED DIRECTIONAL COMPLIANCE LOGIC
 * - Starts clock at turns >= 2
 * - Stops clock when a reverse turn of -2 or more is detected
 */
function calculateDayMetrics(dayLogs) {
    if (!dayLogs || dayLogs.length === 0) return { startTime: "--:--", durationStr: "0m", score: 0, avgPressure: 0 };

    // Sort chronologically to detect movement sequence
    const sorted = [...dayLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let sessionStart = null;
    let sessionEnd = null;
    let activeSessionLogs = [];
    let isCurrentlyActive = false;

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : null;
        
        const currentT = current.turns !== undefined ? current.turns : (current.valve_turns || 0);
        const prevT = prev ? (prev.turns !== undefined ? prev.turns : (prev.valve_turns || 0)) : 0;

        // 1. DETECT OPEN (+2 or more)
        if (!isCurrentlyActive && currentT >= 2) {
            isCurrentlyActive = true;
            sessionStart = new Date(current.created_at);
        }

        // 2. DETECT CLOSE (Drop of 2 or more from previous)
        if (isCurrentlyActive && prev && (prevT - currentT >= 2)) {
            isCurrentlyActive = false;
            // The flow effectively ended at the timestamp BEFORE this drop
            sessionEnd = new Date(prev.created_at);
        }

        // Accumulate data for averages/duration while active
        if (isCurrentlyActive) {
            activeSessionLogs.push(current);
            sessionEnd = new Date(current.created_at); // Continuously update end point
        }
    }

    if (!sessionStart || !sessionEnd) {
        return { startTime: "--:--", durationStr: "0m", score: 0, avgPressure: 0 };
    }

    const durationMs = sessionEnd - sessionStart;
    const durationMin = Math.max(Math.floor(durationMs / 60000), 1);
    const avgP = activeSessionLogs.length > 0 
        ? Math.floor(activeSessionLogs.reduce((acc, l) => acc + (l.pressure_val || 0), 0) / activeSessionLogs.length)
        : 0;

    return { 
        startTime: sessionStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        durationStr: `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`, 
        score: Math.min(Math.floor((durationMin / 120) * 100), 100), 
        avgPressure: avgP 
    };
}

function updateComplianceCard(todayLogs) {
    const metrics = calculateDayMetrics(todayLogs);
    document.getElementById('complianceScore').innerText = metrics.score + "%";
    document.getElementById('startTimeDisplay').innerText = metrics.startTime;
    document.getElementById('durationDisplay').innerText = metrics.durationStr;
    
    const avgDisplay = document.getElementById('avgPressureDisplay');
    avgDisplay.innerText = metrics.avgPressure > 0 ? `${metrics.avgPressure} PSI` : "--";
    avgDisplay.className = metrics.avgPressure > 800 ? "text-tech-success font-bold" : "text-slate-400 font-bold";
    
    const ring = document.getElementById('complianceRing');
    let color = metrics.score >= 80 ? "#10b981" : (metrics.score >= 50 ? "#fbbf24" : "#ef4444");
    ring.style.setProperty('--score-color', color);
    ring.style.setProperty('--score-deg', `${(metrics.score / 100) * 360}deg`);
    
    const statusEl = document.getElementById('scheduleStatus');
    statusEl.innerText = metrics.score >= 80 ? "SCHEDULE ADHERED" : (metrics.score >= 50 ? "PARTIAL ADHERENCE" : "NON-COMPLIANT");
    statusEl.className = `text-[10px] font-bold uppercase mt-1 ${metrics.score >= 80 ? 'text-tech-success' : 'text-red-500'}`;
}
