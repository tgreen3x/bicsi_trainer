/* BICSI Technical Workstation
   Storage helpers
   Handles localStorage keys and save/load functions
*/

/* =========================
   Storage Keys
   ========================= */
const KEY        = "bicsi_trainer_state_v6";
const QB_ROT_KEY = "bicsi_qbank_rotation_v2";
const QB_DATA_KEY= "bicsi_qbank_data_v1";
const MISSES_KEY = "bicsi_misses_v1";
const STATS_KEY  = "bicsi_domain_stats_v1";
const DAILY_KEY  = "bicsi_daily_v1";

function loadState() { 
    try { return JSON.parse(localStorage.getItem(KEY));
       }
    catch { 
        return null; 
    } 
}

function saveState() { 
    localStorage.setItem(KEY, JSON.stringify(state)); 
}

/* =========================
   Misses
   ========================= */
function loadMisses() { 
    try { 
        return JSON.parse(localStorage.getItem(MISSES_KEY))||{}; }
    catch { 
        return {}; 
    } 
}

function saveMisses(m) { 
    localStorage.setItem(MISSES_KEY,JSON.stringify(m)); 
}

function clearMisses() {
    localStorage.removeItem(MISSES_KEY); updateMissCountUI(); 
}

function missesCount() {
    return Object.keys(loadMisses()).length; 
}

function loadStats() {
    try {
        return JSON.parse(localStorage.getItem(STATS_KEY))||{}; 
    } catch {
        return {}; 
    } 
}

function saveStats(s) { 
    localStorage.setItem(STATS_KEY,JSON.stringify(s)); 
}

function loadDaily() { 
    try {
        return JSON.parse(localStorage.getItem(DAILY_KEY))||{}; 
    } catch { 
        return {}; 
    } 
}

function saveDaily(d) { 
    localStorage.setItem(DAILY_KEY,JSON.stringify(d)); 
}

function loadRot() { 
    try { 
        return JSON.parse(localStorage.getItem(QB_ROT_KEY)); 
    } catch { 
        
        return null; 
    } 
}

function saveRot(o) { 
    localStorage.setItem(QB_ROT_KEY,JSON.stringify(o)); 
}
