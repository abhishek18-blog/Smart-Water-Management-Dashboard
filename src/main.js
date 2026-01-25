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
            dashboardSection.classList.add('fade-enter');
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
    let safeDate = dateString.replace(" ", "T"); 
    const dateObj = new Date(safeDate);
    const fixedTime = dateObj.getTime() - (5.5 * 60 * 60 * 1000); 
    return new Date(fixedTime).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' 
    });
}

function getCorrectedDateObject(dateString) {
    let safeDate = dateString.replace(" ", "T");
    const dateObj = new Date(safeDate);
    if (isNaN(dateObj.getTime())) return new Date(); 
    return new Date(dateObj.getTime() - (5.5 * 60 * 60 * 1000));
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
        globalData = await response.json();
        if(globalData.length > 0) {
            updateDeviceList(globalData);
            refreshView();
        }
    } catch (error) {
        console.error("Connection Error:", error);
        const diagText = document.getElementById('diagStatus');
        if(diagText) diagText.innerText = "CONNECTION FAILURE";
    }
}

function updateDeviceList(data) {
    const foundDevices = [...new Set(data.map(item => item.valve_id))];
    if (JSON.stringify(foundDevices.sort()) !== JSON.stringify(uniqueDevices.sort())) {
        uniqueDevices = foundDevices;
        const select = document.getElementById('deviceSelect');
        select.innerHTML = uniqueDevices.map(id => `<option value="${id}">${id}</option>`).join('');
        if (!currentDevice) { currentDevice = uniqueDevices[0]; select.value = currentDevice; }
    }
}

function handleDeviceChange() {
    currentDevice = document.getElementById('deviceSelect').value;
    refreshView();
}

function refreshView() {
    if (!currentDevice || globalData.length === 0) return;
    const deviceHistory = globalData.filter(d => d.valve_id === currentDevice);
    if (deviceHistory.length > 0) {
        deviceHistory.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        updateDashboard(deviceHistory);
    }
}

function updateDashboard(historyData) {
    const sortedDesc = [...historyData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = sortedDesc[0]; 
    const pressure = latest.pressure_val || 0;
    const turns = latest.turns !== undefined ? latest.turns : (latest.valve_turns || 0); 
    
    document.getElementById('pressureVal').innerText = pressure > 800 ? "NORMAL" : "LOW";
    document.getElementById('valveTurns').innerText = turns;
    document.getElementById('lastSync').innerText = getCorrectedDateTime(latest.created_at);
    document.getElementById('pressureGauge').style.width = `${Math.min((pressure / 3000) * 100, 100)}%`;

    runDiagnostics(pressure, turns, latest.valve_status); 
    processDailyStats(historyData);

    const tableHtml = sortedDesc.slice(0, 15).map(row => `
        <tr class="hover:bg-cyan-500/10 transition-colors border-b border-white/5">
            <td class="p-3 text-slate-500 text-[10px] font-mono">${getCorrectedDateTime(row.created_at)}</td>
            <td class="p-3 text-white font-medium">ID:${row.valve_id.slice(-5)}</td>
            <td class="p-3 text-right font-bold uppercase text-[10px] text-tech-cyan">${row.valve_status || "Unknown"}</td>
            <td class="p-3 text-right text-amber-400 font-bold font-mono">${row.turns || 0} TRN</td>
        </tr>`).join('');
    
    document.getElementById('logTableBody').innerHTML = tableHtml;
}

function runDiagnostics(pressure, turns, status) {
    let msg = "SYSTEM NOMINAL"; let color = "#00f2ff"; let icon = "fa-check-circle";
    if (turns > 0 && pressure < 10) {
        msg = "GHOST FLOW DETECTED"; color = "#ff2a2a"; icon = "fa-burst";
    }
    const diagText = document.getElementById('diagStatus');
    const iconBox = document.getElementById('diagIconBox');
    diagText.innerText = msg; diagText.style.color = color;
    document.getElementById('diagnosticPanel').style.borderLeftColor = color;
    if(iconBox) iconBox.innerHTML = `<i class="fas ${icon}"></i>`;
}

function processDailyStats(logs) {
    const grouped = {};
    logs.forEach(log => {
        const correctedDate = getCorrectedDateObject(log.created_at);
        const dateKey = `${correctedDate.getFullYear()}-${String(correctedDate.getMonth()+1).padStart(2,'0')}-${String(correctedDate.getDate()).padStart(2,'0')}`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(log);
    });

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    updateComplianceCard(grouped[todayKey] || []);

    const sortedDates = Object.keys(grouped).sort().reverse(); 
    let tableHtml = "";
    sortedDates.slice(0, 5).forEach(date => {
        const stats = calculateDayMetrics(grouped[date]);
        let scoreColor = stats.score >= 80 ? "text-tech-success" : (stats.score >= 50 ? "text-tech-warn" : "text-red-500");
        tableHtml += `<tr class="hover:bg-cyan-500/10 transition-colors border-b border-white/5">
            <td class="p-3 text-white font-bold">${date}</td>
            <td class="p-3 text-right text-slate-400">${stats.startTime}</td>
            <td class="p-3 text-right text-white">${stats.durationStr}</td>
            <td class="p-3 text-center font-bold ${scoreColor}">${stats.score}%</td>
            <td class="p-3 text-center font-bold text-slate-500">${stats.avgPressure > 0 ? stats.avgPressure + ' PSI' : '--'}</td>
        </tr>`;
    });
    document.getElementById('dailyStatsBody').innerHTML = tableHtml;
}

/**
 * INTEGRATED DELTA COMPLIANCE LOGIC
 * - Starts clock at turns >= 2
 * - Stops clock when drop (prev - current) >= 2 OR current hits 0
 */
function calculateDayMetrics(dayLogs) {
    if (!dayLogs || dayLogs.length === 0) return { startTime: "--:--", durationStr: "0m", score: 0, avgPressure: 0 };

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

        // 1. OPEN LOGIC (>= 2 turns)
        if (!isCurrentlyActive && currentT >= 2) {
            isCurrentlyActive = true;
            sessionStart = new Date(current.created_at);
        }

        // 2. CLOSE LOGIC (Drop of 2+ units OR hitting 0)
        if (isCurrentlyActive && prev) {
            const dropDelta = prevT - currentT;
            if (dropDelta >= 2 || currentT === 0) {
                isCurrentlyActive = false;
                sessionEnd = new Date(prev.created_at); // Clock stops at last valid operational reading
            }
        }

        if (isCurrentlyActive) {
            activeSessionLogs.push(current);
            sessionEnd = new Date(current.created_at); 
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
