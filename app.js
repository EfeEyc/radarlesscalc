// AYT TMA Radarless Approach Calculator & Conflict Finder
// Speed: 5 NM / 1 minute (300 kt GS)
// Chart scale: 4.2 px per NM from center (430, 430)

const SPEED_NM_PER_MIN = 5;
const SVG_CENTER_X = 430;
const SVG_CENTER_Y = 430;
const PX_PER_NM = 4.2;

const WAYPOINTS = [
  {
    id: "DERYA",
    name: "DERYA",
    entryWpt: "TOMBİ",
    airway: "VA-16",
    radial: "R-170",
    deg: 170,
    fl: "FL070",
    meaFt: 7000,
    msaFt: 3000,
    defaultArrFl: 90,
    defaultDepFl: 110,
    straightInRwy: "36",
  },
  {
    id: "KUMRU",
    name: "KUMRU",
    entryWpt: "KFK",
    airway: "VA-16",
    radial: "R-350",
    deg: 350,
    fl: "FL120",
    meaFt: 12000,
    msaFt: 10000,
    defaultArrFl: 140,
    defaultDepFl: 140,
    straightInRwy: "18",
  },
  {
    id: "BRONZ",
    name: "BRONZ",
    entryWpt: "CRD",
    airway: "R-55",
    radial: "R-310",
    deg: 310,
    fl: "FL110",
    meaFt: 11000,
    msaFt: 10000,
    defaultArrFl: 130,
    defaultDepFl: 130,
    straightInRwy: null,
  },
  {
    id: "ALPAY",
    name: "ALPAY",
    entryWpt: "W-79",
    airway: "W-79",
    radial: "R-270",
    deg: 270,
    fl: "FL120",
    meaFt: 12000,
    msaFt: 12000,
    defaultArrFl: 140,
    defaultDepFl: 140,
    straightInRwy: null,
  },
  {
    id: "DAMLA",
    name: "DAMLA",
    entryWpt: "HİSAR",
    airway: "W-77",
    radial: "R-030",
    deg: 30,
    fl: "FL130",
    meaFt: 13000,
    msaFt: 9000,
    defaultArrFl: 150,
    defaultDepFl: 150,
    straightInRwy: null,
  },
  {
    id: "KONAK",
    name: "KONAK",
    entryWpt: "MUT",
    airway: "R-55",
    radial: "R-090",
    deg: 90,
    fl: "FL130",
    meaFt: 13000,
    msaFt: 9000,
    defaultArrFl: 150,
    defaultDepFl: 150,
    straightInRwy: null,
  },
  {
    id: "MANAV",
    name: "MANAV",
    entryWpt: "DOREN",
    airway: "W-83",
    radial: "R-130",
    deg: 130,
    fl: "FL070",
    meaFt: 7000,
    msaFt: 3000,
    defaultArrFl: 90,
    defaultDepFl: 110,
    straightInRwy: null,
  },
];

const AYT_VOR_POINT = {
  id: "AYT",
  name: "AYT VOR",
  entryWpt: "0 NM",
  airway: "VOR",
  radial: "CENTER",
  deg: 0,
  fl: "—",
  meaFt: 0,
  msaFt: 3000,
  defaultArrFl: 150,
  defaultDepFl: 150,
  straightInRwy: null,
};

const ALL_ROUTE_POINTS = [...WAYPOINTS, AYT_VOR_POINT];

function getWaypointOrVor(id) {
  if (id === "AYT") return AYT_VOR_POINT;
  return WAYPOINTS.find((w) => w.id === id) || WAYPOINTS[0];
}

// Application State
const state = {
  activeView: "calc", // 'calc' | 'chart'
  activeRwy: "36",
  wizardOpen: false,
  wizardStepIdx: 0,
  flightType: "ARR", // 'ARR' | 'DEP' | 'TRN'
  selectedWpt: "DERYA",
  transitRoute: ["KUMRU", "AYT", "DERYA"], // Route array for Transit planes
  selectedDist: 60,
  selectedFl: 250,
  inputTimeRaw: "00",
  inputCallsign: "",
  globalQueryDme: 30,
  lookupTimeRaw: "00",
  aircraftList: [],
  nextId: 1,
  playInterval: null,
};

function normalizeTransitEndpoints(acft) {
  let entryWptId = acft.entryWptId || acft.wptId || "KUMRU";
  let exitWptId = acft.exitWptId || "DERYA";

  if (Array.isArray(acft.route) && acft.route.length > 0) {
    entryWptId = acft.route[0];
    if (acft.route.length === 1) {
      exitWptId = entryWptId === "AYT" ? "DERYA" : "AYT";
    } else {
      exitWptId = acft.route[acft.route.length - 1];
    }
  }
  return { entryWptId, exitWptId };
}

function loadSavedState() {
  try {
    const saved =
      localStorage.getItem("ayt_radarsiz_state_v4") ||
      localStorage.getItem("ayt_radarsiz_state_v3") ||
      localStorage.getItem("ayt_radarsiz_state_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.activeRwy) state.activeRwy = parsed.activeRwy;
      if (typeof parsed.globalQueryDme === "number") {
        state.globalQueryDme = parsed.globalQueryDme;
      }
      if (Array.isArray(parsed.aircraftList)) {
        state.aircraftList = parsed.aircraftList.map((a) => {
          const wpt = getWaypointOrVor(a.wptId || a.entryWptId);
          const type = a.type || "ARR";
          const endpoints =
            type === "TRN" ? normalizeTransitEndpoints(a) : { entryWptId: a.wptId, exitWptId: null };
          return {
            ...a,
            type,
            wptId: a.wptId || endpoints.entryWptId || "DERYA",
            entryWptId: endpoints.entryWptId,
            exitWptId: endpoints.exitWptId,
            fl: a.fl || (type === "DEP" ? wpt.defaultDepFl : wpt.defaultArrFl),
            queryDme: typeof a.queryDme === "number" ? a.queryDme : state.globalQueryDme,
          };
        });
      }
      if (typeof parsed.nextId === "number") state.nextId = parsed.nextId;
    }
  } catch (err) {
    console.warn("Could not load state from localStorage:", err);
  }
}

function saveState() {
  try {
    localStorage.setItem(
      "ayt_radarsiz_state_v4",
      JSON.stringify({
        activeRwy: state.activeRwy,
        globalQueryDme: state.globalQueryDme,
        aircraftList: state.aircraftList,
        nextId: state.nextId,
      })
    );
  } catch (err) {
    console.warn("Could not save state:", err);
  }
}

// Convert user FL or altitude number to feet
function flInputToFeet(val) {
  const n = Number(val) || 0;
  if (n <= 0) return 10000;
  if (n <= 25) return n * 1000;
  if (n <= 500) return n * 100;
  return n;
}

// Format feet as ATC altitude / Flight Level string
function formatAlt(feet) {
  const f = Math.round(Number(feet) || 0);
  if (f >= 11000) {
    return `FL${Math.round(f / 100)}`;
  }
  if (f === 7000) {
    return `FL070 (7,000')`;
  }
  return `${f.toLocaleString("en-US")}'`;
}

function formatAltShort(feet) {
  const f = Math.round(Number(feet) || 0);
  if (f >= 11000) return `FL${Math.round(f / 100)}`;
  return `${f}'`;
}

// Parse flexible time input: "0", "5", "05", ":05", "10:05", "9:30", "1005"
function parseTimeInput(rawStr) {
  const s = String(rawStr ?? "").trim();
  if (!s) {
    return { valid: true, hasHour: false, totalMinutes: 0 };
  }

  if (s.startsWith(":")) {
    const m = parseFloat(s.slice(1));
    if (!Number.isNaN(m)) {
      return { valid: true, hasHour: false, totalMinutes: m };
    }
  }

  if (s.includes(":")) {
    const parts = s.split(":");
    const hh = parseInt(parts[0], 10);
    const mm = parseFloat(parts[1]);
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      return {
        valid: true,
        hasHour: true,
        totalMinutes: hh * 60 + mm,
      };
    }
  }

  const digitsOnly = /^\d{3,4}$/.test(s);
  const num = parseFloat(s);
  if (!Number.isNaN(num)) {
    if (digitsOnly && num >= 100) {
      const hh = Math.floor(num / 100);
      const mm = num % 100;
      return {
        valid: true,
        hasHour: true,
        totalMinutes: hh * 60 + mm,
      };
    }
    return {
      valid: true,
      hasHour: false,
      totalMinutes: num,
    };
  }

  return { valid: false, hasHour: false, totalMinutes: 0 };
}

function formatTime(totalMins, hasHour = false) {
  if (totalMins === null || totalMins === undefined || Number.isNaN(totalMins)) {
    return "—";
  }

  const totalSeconds = Math.round(totalMins * 60);
  const sign = totalSeconds < 0 ? "-" : "";
  const absSeconds = Math.abs(totalSeconds);
  const wholeMins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const secSuffix = secs > 0 ? `:${String(secs).padStart(2, "0")}` : "";

  if (hasHour) {
    const hh = Math.floor(wholeMins / 60) % 24;
    const mm = wholeMins % 60;
    return `${sign}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${secSuffix}`;
  } else {
    if (wholeMins >= 60) {
      const modMm = wholeMins % 60;
      return `:${String(modMm).padStart(2, "0")}${secSuffix} (${wholeMins}')`;
    }
    return `${sign}:${String(wholeMins).padStart(2, "0")}${secSuffix}`;
  }
}

function isAircraftStraightIn(wptId, _mode, activeRwy) {
  if (activeRwy === "36" && wptId === "DERYA") return true;
  if (activeRwy === "18" && wptId === "KUMRU") return true;
  return false;
}

function getReferenceBaseHour(items) {
  for (const item of items) {
    const p = parseTimeInput(item.timeRaw);
    if (p.hasHour) {
      return Math.floor(p.totalMinutes / 60);
    }
  }
  return null;
}

function normalizeTime(mins, hasHour, refHour) {
  if (!hasHour && refHour !== null && mins < 120) {
    return refHour * 60 + mins;
  }
  return mins;
}

function denormalizeTime(normMins, hasHour, refHour) {
  if (!hasHour && refHour !== null && normMins >= refHour * 60) {
    return normMins - refHour * 60;
  }
  return normMins;
}

// ============================================================================
// CHECKPOINT & CUSTOM DME CROSSING CALCULATORS (ARRIVAL, DEPARTURE, TRANSIT)
// ============================================================================

// 1. Arrival Checkpoints (Flies TO AYT VOR at 5 NM / 1 min)
function calculateArrivalCheckpoints(
  { wptId, dist, timeRaw, mode, holdMins = 0, fl, queryDme = 30 },
  activeRwy
) {
  const wpt = WAYPOINTS.find((w) => w.id === wptId) || WAYPOINTS[0];
  const parsedTime = parseTimeInput(timeRaw);
  const tInit = parsedTime.totalMinutes;
  const hasHour = parsedTime.hasHour;
  const straightIn = isAircraftStraightIn(wptId, mode, activeRwy);
  const d = Number(dist) || 60;
  const hold = Number(holdMins) || 0;
  const initAltFt = flInputToFeet(fl || wpt.defaultArrFl);
  const qDme = queryDme !== undefined && queryDme !== "" ? Number(queryDme) : 30;

  const t25 = d >= 25 ? tInit + (d - 25) / SPEED_NM_PER_MIN : null;
  const t15 = d >= 15 ? tInit + (d - 15) / SPEED_NM_PER_MIN : null;
  const t10 = d >= 10 ? tInit + (d - 10) / SPEED_NM_PER_MIN : tInit;
  const tRadialZero = tInit + d / SPEED_NM_PER_MIN;

  // Custom DME crossing time TO AYT
  const tQueryTo =
    !Number.isNaN(qDme) && qDme >= 0 ? tRadialZero - qDme / SPEED_NM_PER_MIN : null;

  let tVor = null;
  let tFixBase = null;
  let tFix = null;
  let tEstBase = null;
  let tEst = null;
  let tClearBase = null;

  if (straightIn) {
    tClearBase = t25 !== null ? t25 : tInit;
    tEstBase = t10;
    tEst = t10 + hold;
  } else {
    tClearBase = t10;
    tVor = t10 + 2;
    tFixBase = tVor + 2;
    tFix = tFixBase + hold;
    tEstBase = tFixBase + 5;
    tEst = tFix + 5;
  }

  return {
    wptId,
    dist: d,
    hasHour,
    straightIn,
    holdMins: hold,
    initAltFt,
    qDme,
    tQueryTo,
    tInit,
    t25,
    t15,
    t10,
    tVor,
    tFixBase,
    tFix,
    tEstBase,
    tEst,
    tClearBase,
    tRadialZero,
  };
}

// 2. Departure Checkpoints (Starts at 0 NM at depTime, flies FROM AYT VOR at 5 NM / 1 min)
function calculateDepartureCheckpoints({ wptId, timeRaw, fl, queryDme = 30 }) {
  const wpt = WAYPOINTS.find((w) => w.id === wptId) || WAYPOINTS[0];
  const parsedTime = parseTimeInput(timeRaw);
  const tDep = parsedTime.totalMinutes;
  const hasHour = parsedTime.hasHour;
  const reqAltFt = flInputToFeet(fl || wpt.defaultDepFl);
  const qDme = queryDme !== undefined && queryDme !== "" ? Number(queryDme) : 30;

  // Custom DME crossing time FROM AYT
  const tQueryFrom =
    !Number.isNaN(qDme) && qDme >= 0 ? tDep + qDme / SPEED_NM_PER_MIN : null;

  return {
    wptId,
    hasHour,
    reqAltFt,
    qDme,
    tQueryFrom,
    tDep,
    t10: tDep + 2,
    t15: tDep + 3,
    t25: tDep + 5,
    t50: tDep + 10,
    t60: tDep + 12,
  };
}

// 3. Transit Checkpoints (Enters at entryWpt -> flies TO AYT VOR -> flies FROM AYT VOR toward exitWpt, maintaining FL)
function calculateTransitCheckpoints(acft) {
  const { entryWptId, exitWptId } = normalizeTransitEndpoints(acft);
  const entryWpt = getWaypointOrVor(entryWptId);
  const exitWpt = getWaypointOrVor(exitWptId);
  const parsedTime = parseTimeInput(acft.timeRaw);
  const tInit = parsedTime.totalMinutes;
  const hasHour = parsedTime.hasHour;
  const d = entryWptId === "AYT" ? 0 : Number(acft.dist) || 60;
  const maintAltFt = flInputToFeet(acft.fl || 150);
  const qDme =
    acft.queryDme !== undefined && acft.queryDme !== "" ? Number(acft.queryDme) : 30;

  const hasInbound = entryWptId !== "AYT";
  const hasOutbound = Boolean(exitWptId && exitWptId !== "AYT");

  // Inbound TO AYT VOR
  const t25To = hasInbound && d >= 25 ? tInit + (d - 25) / SPEED_NM_PER_MIN : null;
  const t15To = hasInbound && d >= 15 ? tInit + (d - 15) / SPEED_NM_PER_MIN : null;
  const t10To = hasInbound && d >= 10 ? tInit + (d - 10) / SPEED_NM_PER_MIN : null;
  const tVor = hasInbound ? tInit + d / SPEED_NM_PER_MIN : tInit;

  // Outbound FROM AYT VOR
  const t10From = hasOutbound ? tVor + 2 : null;
  const t15From = hasOutbound ? tVor + 3 : null;
  const t25From = hasOutbound ? tVor + 5 : null;
  const t50From = hasOutbound ? tVor + 10 : null;
  const t60From = hasOutbound ? tVor + 12 : null;

  // Custom DME crossing times: BOTH TO AYT (on entryWpt) and FROM AYT (on exitWpt)
  const tQueryTo =
    hasInbound && !Number.isNaN(qDme) && qDme >= 0 ? tVor - qDme / SPEED_NM_PER_MIN : null;
  const tQueryFrom =
    hasOutbound && !Number.isNaN(qDme) && qDme >= 0 ? tVor + qDme / SPEED_NM_PER_MIN : null;

  return {
    entryWptId,
    exitWptId,
    entryWpt,
    exitWpt,
    hasInbound,
    hasOutbound,
    dist: d,
    hasHour,
    maintAltFt,
    qDme,
    tQueryTo,
    tQueryFrom,
    tInit,
    t25To,
    t15To,
    t10To,
    tVor,
    t10From,
    t15From,
    t25From,
    t50From,
    t60From,
  };
}

// ============================================================================
// CONFLICT FINDER ENGINE (ARRIVALS, DEPARTURES & TRANSIT)
// Finds:
// 1. Head-On Conflicts on the same Waypoint/Radial (DEP<->ARR, TRN<->ARR, TRN<->DEP, TRN<->TRN)
// 2. Radial, Same-Track & <15 NM AYT VOR Convergence Conflicts
// 3. Approach Sequence & ILS / EAT Window Delays
// ============================================================================
function analyzeScenarioConflicts(aircraftList, activeRwy) {
  const refHour = getReferenceBaseHour(aircraftList);
  const useHasHour = refHour !== null;

  const arrivalsRaw = aircraftList.filter((a) => a.type === "ARR" || !a.type);
  const departuresRaw = aircraftList.filter((a) => a.type === "DEP");
  const transitsRaw = aircraftList.filter((a) => a.type === "TRN");

  const computedArrivals = arrivalsRaw.map((acft) => {
    const wpt = WAYPOINTS.find((w) => w.id === acft.wptId) || WAYPOINTS[0];
    const calc = calculateArrivalCheckpoints(acft, activeRwy);
    return {
      acft,
      wpt,
      calc,
      normInit: normalizeTime(calc.tInit, calc.hasHour, refHour),
      norm25: calc.t25 !== null ? normalizeTime(calc.t25, calc.hasHour, refHour) : null,
      norm15: calc.t15 !== null ? normalizeTime(calc.t15, calc.hasHour, refHour) : null,
      norm10: normalizeTime(calc.t10, calc.hasHour, refHour),
      normVor: calc.tVor !== null ? normalizeTime(calc.tVor, calc.hasHour, refHour) : null,
      normFixBase: calc.tFixBase !== null ? normalizeTime(calc.tFixBase, calc.hasHour, refHour) : null,
      normClearBase: normalizeTime(calc.tClearBase, calc.hasHour, refHour),
      normRadialZero: normalizeTime(calc.tRadialZero, calc.hasHour, refHour),
    };
  });

  const computedDepartures = departuresRaw.map((acft) => {
    const wpt = WAYPOINTS.find((w) => w.id === acft.wptId) || WAYPOINTS[0];
    const calc = calculateDepartureCheckpoints(acft);
    return {
      acft,
      wpt,
      calc,
      normDep: normalizeTime(calc.tDep, calc.hasHour, refHour),
      norm10: normalizeTime(calc.t10, calc.hasHour, refHour),
      norm15: normalizeTime(calc.t15, calc.hasHour, refHour),
      norm25: normalizeTime(calc.t25, calc.hasHour, refHour),
      norm60: normalizeTime(calc.t60, calc.hasHour, refHour),
    };
  });

  const computedTransits = transitsRaw.map((acft) => {
    const calc = calculateTransitCheckpoints(acft);
    return {
      acft,
      entryWpt: calc.entryWpt,
      exitWpt: calc.exitWpt,
      calc,
      normInit: normalizeTime(calc.tInit, calc.hasHour, refHour),
      norm25To: calc.t25To !== null ? normalizeTime(calc.t25To, calc.hasHour, refHour) : null,
      norm15To: calc.t15To !== null ? normalizeTime(calc.t15To, calc.hasHour, refHour) : null,
      norm10To: calc.t10To !== null ? normalizeTime(calc.t10To, calc.hasHour, refHour) : null,
      normVor: normalizeTime(calc.tVor, calc.hasHour, refHour),
      norm10From: calc.t10From !== null ? normalizeTime(calc.t10From, calc.hasHour, refHour) : null,
      norm15From: calc.t15From !== null ? normalizeTime(calc.t15From, calc.hasHour, refHour) : null,
      norm25From: calc.t25From !== null ? normalizeTime(calc.t25From, calc.hasHour, refHour) : null,
      norm60From: calc.t60From !== null ? normalizeTime(calc.t60From, calc.hasHour, refHour) : null,
    };
  });

  // --------------------------------------------------------------------------
  // 1. Arrival Sequencing & Expected Approach Time (EAT) Calculation
  // --------------------------------------------------------------------------
  const sequencedArrivals = [...computedArrivals].sort((a, b) => {
    if (a.normClearBase !== b.normClearBase) return a.normClearBase - b.normClearBase;
    if (a.wpt.msaFt !== b.wpt.msaFt) return a.wpt.msaFt - b.wpt.msaFt;
    return a.acft.id - b.acft.id;
  });

  const eatMap = new Map();
  let prevEstNorm = null;
  let prevAcft = null;

  sequencedArrivals.forEach((item, index) => {
    const { acft, calc } = item;
    const manualHold = calc.holdMins || 0;

    let willDelay = false;
    let eatNorm = null;
    let autoHoldMins = 0;
    let effectiveFixNorm = item.normFixBase;
    let effectiveEstNorm = null;
    let clearancePhaseNote = "";

    if (prevEstNorm !== null && item.normClearBase < prevEstNorm) {
      willDelay = true;
      eatNorm = prevEstNorm;

      if (calc.straightIn) {
        if (eatNorm <= item.norm10) {
          autoHoldMins = 0;
          effectiveEstNorm = item.norm10 + manualHold;
          const dmeAtEat = +(10 + (item.norm10 - eatNorm) * SPEED_NM_PER_MIN).toFixed(1);
          clearancePhaseNote = `Gets ILS clearance at EAT (${formatTime(
            denormalizeTime(eatNorm, calc.hasHour, refHour),
            calc.hasHour
          )}) at ${dmeAtEat} NM — No hold needed`;
        } else {
          autoHoldMins = +(eatNorm - item.norm10).toFixed(1);
          effectiveEstNorm = eatNorm + 5 + manualHold;
          clearancePhaseNote = `Holds ${autoHoldMins}m at 10 DME FIX until EAT (${formatTime(
            denormalizeTime(eatNorm, calc.hasHour, refHour),
            calc.hasHour
          )}), then +5m to Establish`;
        }
      } else {
        if (eatNorm <= item.normFixBase) {
          autoHoldMins = 0;
          effectiveFixNorm = item.normFixBase + manualHold;
          effectiveEstNorm = effectiveFixNorm + 5;
          if (eatNorm <= item.normVor) {
            const dmeToVor = +((item.normVor - eatNorm) * SPEED_NM_PER_MIN).toFixed(1);
            clearancePhaseNote = `EAT is ${formatTime(
              denormalizeTime(eatNorm, calc.hasHour, refHour),
              calc.hasHour
            )} (at ${
              dmeToVor === 0 ? "AYT VOR" : `${dmeToVor} NM inbound to VOR`
            }) — No hold occurs!`;
          } else {
            const dmeOut = +((eatNorm - item.normVor) * SPEED_NM_PER_MIN).toFixed(1);
            clearancePhaseNote = `EAT is ${formatTime(
              denormalizeTime(eatNorm, calc.hasHour, refHour),
              calc.hasHour
            )} (at ${dmeOut} NM outbound to 10 DME FIX) — No hold occurs!`;
          }
        } else {
          autoHoldMins = +(eatNorm - item.normFixBase).toFixed(1);
          effectiveFixNorm = eatNorm + manualHold;
          effectiveEstNorm = effectiveFixNorm + 5;
          clearancePhaseNote = `Holds ${autoHoldMins}m at 10 DME FIX until EAT (${formatTime(
            denormalizeTime(eatNorm, calc.hasHour, refHour),
            calc.hasHour
          )}), then +5m to full establish`;
        }
      }
    } else {
      willDelay = false;
      eatNorm = null;
      autoHoldMins = 0;
      if (calc.straightIn) {
        effectiveEstNorm = item.norm10 + manualHold;
        clearancePhaseNote = `Cleared Straight-In ILS at 25 NM`;
      } else {
        effectiveFixNorm = item.normFixBase + manualHold;
        effectiveEstNorm = effectiveFixNorm + 5;
        clearancePhaseNote = `Cleared ILS at 10 NM`;
      }
    }

    const eatDisplay =
      eatNorm !== null
        ? formatTime(denormalizeTime(eatNorm, calc.hasHour, refHour), calc.hasHour)
        : "—";
    const effectiveFixDisplay =
      effectiveFixNorm !== null
        ? formatTime(denormalizeTime(effectiveFixNorm, calc.hasHour, refHour), calc.hasHour)
        : "—";
    const effectiveEstDisplay = formatTime(
      denormalizeTime(effectiveEstNorm, calc.hasHour, refHour),
      calc.hasHour
    );

    eatMap.set(acft.id, {
      seqNum: index + 1,
      willDelay,
      blockedBy: willDelay ? prevAcft : null,
      eatNorm,
      eatDisplay,
      autoHoldMins,
      effectiveFixNorm,
      effectiveFixDisplay,
      effectiveEstNorm,
      effectiveEstDisplay,
      clearancePhaseNote,
    });

    prevEstNorm = effectiveEstNorm;
    prevAcft = item;
  });

  // --------------------------------------------------------------------------
  // 2. Head-On Conflicts (Opposite-Direction on Same Waypoint / Radial)
  // Covers:
  //   - Departure (FROM AYT) <-> Arrival (TO AYT)
  //   - Transit Outbound (FROM AYT) <-> Arrival (TO AYT)
  //   - Departure (FROM AYT) <-> Transit Inbound (TO AYT)
  //   - Transit Outbound (FROM AYT) <-> Transit Inbound (TO AYT)
  // --------------------------------------------------------------------------
  const inboundLegs = [];
  const outboundLegs = [];

  computedArrivals.forEach((arr) => {
    inboundLegs.push({
      kind: "ARR",
      icon: "🛬",
      acft: arr.acft,
      wpt: arr.wpt,
      tZeroNorm: arr.normRadialZero,
      maxDist: Math.max(arr.calc.dist, 60),
      altSummary: `Descends from ${formatAlt(arr.calc.initAltFt)} → MEA ${formatAlt(
        arr.wpt.meaFt
      )} → MSA ${formatAlt(arr.wpt.msaFt)}`,
      maintAltFt: null,
      minAltFt: arr.wpt.msaFt,
      maxAltFt: arr.calc.initAltFt,
    });
  });

  computedDepartures.forEach((dep) => {
    outboundLegs.push({
      kind: "DEP",
      icon: "🛫",
      acft: dep.acft,
      wpt: dep.wpt,
      tZeroNorm: dep.normDep,
      maxDist: 60,
      altSummary: `Climbs to MSA ${formatAlt(dep.wpt.msaFt)} (<10 NM) → MEA ${formatAlt(
        dep.wpt.meaFt
      )} (<25 NM) → Req ${formatAlt(dep.calc.reqAltFt)}`,
      maintAltFt: null,
      minAltFt: 0,
      maxAltFt: dep.calc.reqAltFt,
    });
  });

  computedTransits.forEach((trn) => {
    if (trn.calc.hasInbound) {
      inboundLegs.push({
        kind: "TRN",
        icon: "✈️",
        acft: trn.acft,
        wpt: trn.entryWpt,
        tZeroNorm: trn.normVor,
        maxDist: Math.max(trn.calc.dist, 60),
        altSummary: `Transit maintaining ${formatAlt(trn.calc.maintAltFt)} inbound via ${
          trn.entryWpt.name
        }`,
        maintAltFt: trn.calc.maintAltFt,
        minAltFt: trn.calc.maintAltFt,
        maxAltFt: trn.calc.maintAltFt,
      });
    }
    if (trn.calc.hasOutbound) {
      outboundLegs.push({
        kind: "TRN",
        icon: "✈️",
        acft: trn.acft,
        wpt: trn.exitWpt,
        tZeroNorm: trn.normVor,
        maxDist: 60,
        altSummary: `Transit maintaining ${formatAlt(trn.calc.maintAltFt)} outbound via ${
          trn.exitWpt.name
        }`,
        maintAltFt: trn.calc.maintAltFt,
        minAltFt: trn.calc.maintAltFt,
        maxAltFt: trn.calc.maintAltFt,
      });
    }
  });

  const headOnConflicts = [];

  outboundLegs.forEach((outLeg) => {
    inboundLegs.forEach((inLeg) => {
      if (outLeg.acft.id === inLeg.acft.id) return;
      if (outLeg.wpt.id !== inLeg.wpt.id) return;

      const wpt = outLeg.wpt;
      const tCrossNorm = (outLeg.tZeroNorm + inLeg.tZeroNorm) / 2;
      const dCross = +(SPEED_NM_PER_MIN * (tCrossNorm - outLeg.tZeroNorm)).toFixed(1);
      const maxCheckDist = Math.max(inLeg.maxDist, outLeg.maxDist, 60);
      const isValidInboundConflict = dCross >= 0 && dCross <= maxCheckDist;

      let zone = "";
      if (dCross >= 25) {
        zone = "≥ 25 NM (Enroute / MEA Zone)";
      } else if (dCross >= 10) {
        zone = "10–25 NM (MSA Transition Zone)";
      } else {
        zone = "< 10 NM (Inner VOR Zone)";
      }

      const crossTimeStr = formatTime(
        denormalizeTime(tCrossNorm, useHasHour, refHour),
        useHasHour
      );

      let conflictNote = "";
      if (outLeg.kind === "TRN" && inLeg.kind === "TRN") {
        const diff = Math.abs(outLeg.maintAltFt - inLeg.maintAltFt);
        conflictNote =
          diff < 1000
            ? `CRITICAL: Both Transit aircraft maintain ${formatAlt(
                outLeg.maintAltFt
              )} head-on on ${wpt.name}! Cross at ${dCross} NM @ ${crossTimeStr}.`
            : `Head-on Transit crossing on ${wpt.name} at ${dCross} NM @ ${crossTimeStr} (${
                outLeg.acft.callsign
              } @ ${formatAlt(outLeg.maintAltFt)} vs ${inLeg.acft.callsign} @ ${formatAlt(
                inLeg.maintAltFt
              )}).`;
      } else if (outLeg.kind === "TRN" || inLeg.kind === "TRN") {
        const trnLeg = outLeg.kind === "TRN" ? outLeg : inLeg;
        const otherLeg = outLeg.kind === "TRN" ? inLeg : outLeg;
        conflictNote = `Head-on with Transit ${trnLeg.acft.callsign} (maintaining ${formatAlt(
          trnLeg.maintAltFt
        )}) on ${wpt.name}! ${otherLeg.acft.callsign} (${
          otherLeg.altSummary
        }) crosses ${trnLeg.acft.callsign} at ${dCross} NM @ ${crossTimeStr}.`;
      } else {
        conflictNote = `Head-on Departure ↔ Arrival on ${wpt.name}: ${outLeg.acft.callsign} (outbound) and ${inLeg.acft.callsign} (inbound) cross at ${dCross} NM @ ${crossTimeStr} (${zone}).`;
      }

      headOnConflicts.push({
        outLeg,
        inLeg,
        wpt,
        tCrossNorm,
        displayTime: crossTimeStr,
        dCross,
        zone,
        isValidInboundConflict,
        conflictNote,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. Radial, Same-Direction & <15 NM AYT VOR Convergence Conflicts
  // --------------------------------------------------------------------------
  const radialConflicts = [];

  // 3A. Build <15 NM AYT VOR Occupancy Windows for all aircraft (ARR, DEP, TRN)
  const vor15Occupants = [];

  sequencedArrivals.forEach((arr) => {
    const eatInfo = eatMap.get(arr.acft.id);
    const tEnter = arr.norm15 !== null ? arr.norm15 : arr.normInit;
    const tExit = eatInfo ? eatInfo.effectiveEstNorm : arr.norm10 + 9;
    vor15Occupants.push({
      kind: "ARR",
      icon: "🛬",
      acft: arr.acft,
      corridorLabel: arr.wpt.name,
      tEnter,
      tExit,
      altLabel: `MSA ${formatAltShort(arr.wpt.msaFt)} → ILS`,
    });
  });

  computedDepartures.forEach((dep) => {
    vor15Occupants.push({
      kind: "DEP",
      icon: "🛫",
      acft: dep.acft,
      corridorLabel: dep.wpt.name,
      tEnter: dep.normDep,
      tExit: dep.norm15,
      altLabel: `Climb ≥${formatAltShort(dep.wpt.msaFt)} MSA`,
    });
  });

  computedTransits.forEach((trn) => {
    const tEnter = trn.calc.hasInbound
      ? trn.norm15To !== null
        ? trn.norm15To
        : trn.normInit
      : trn.normVor;
    const tExit = trn.calc.hasOutbound ? trn.norm15From : trn.normVor;
    vor15Occupants.push({
      kind: "TRN",
      icon: "✈️",
      acft: trn.acft,
      corridorLabel: `${trn.entryWpt.name}→${trn.exitWpt.name}`,
      tEnter,
      tExit,
      altLabel: `Maintains ${formatAlt(trn.calc.maintAltFt)}`,
    });
  });

  for (let i = 0; i < vor15Occupants.length; i++) {
    for (let j = i + 1; j < vor15Occupants.length; j++) {
      const A = vor15Occupants[i];
      const B = vor15Occupants[j];
      const ovStart = Math.max(A.tEnter, B.tEnter);
      const ovEnd = Math.min(A.tExit, B.tExit);

      if (ovStart < ovEnd - 1e-6) {
        const startStr = formatTime(denormalizeTime(ovStart, useHasHour, refHour), useHasHour);
        const endStr = formatTime(denormalizeTime(ovEnd, useHasHour, refHour), useHasHour);
        radialConflicts.push({
          pairLabel: `${A.icon} ${A.acft.callsign} (${A.corridorLabel}) & ${B.icon} ${B.acft.callsign} (${B.corridorLabel})`,
          badgeText: `< 15 NM VOR OVERLAP`,
          windowStr: `${startStr}–${endStr}`,
          detailText: `Both aircraft are inside <strong>15 NM of AYT VOR</strong> simultaneously from <code>${startStr}</code> to <code>${endStr}</code> (${A.acft.callsign}: ${A.altLabel} • ${B.acft.callsign}: ${B.altLabel}). Maintain ≥1,000 ft vertical separation inside 15 NM.`,
          isAlert: true,
        });
      }
    }
  }

  // 3B. Same-Direction Same-Waypoint Proximity (< 3 min / 15 NM on same leg)
  for (let i = 0; i < inboundLegs.length; i++) {
    for (let j = i + 1; j < inboundLegs.length; j++) {
      const A = inboundLegs[i];
      const B = inboundLegs[j];
      if (A.wpt.id !== B.wpt.id) continue;
      const gapMins = Math.abs(A.tZeroNorm - B.tZeroNorm);
      const gapNm = +(gapMins * SPEED_NM_PER_MIN).toFixed(1);
      if (gapMins < 5) {
        radialConflicts.push({
          pairLabel: `${A.icon} ${A.acft.callsign} & ${B.icon} ${B.acft.callsign}`,
          badgeText: `SAME INBOUND (${A.wpt.name})`,
          windowStr: `${gapNm} NM (${+gapMins.toFixed(1)}m) spacing`,
          detailText: `Both flying inbound (TO AYT) on <strong>${A.wpt.name}</strong> with <strong>${gapNm} NM (${+gapMins.toFixed(
            1
          )} min)</strong> spacing (${A.acft.callsign}: ${A.altSummary} • ${B.acft.callsign}: ${
            B.altSummary
          }).`,
          isAlert: true,
        });
      }
    }
  }

  for (let i = 0; i < outboundLegs.length; i++) {
    for (let j = i + 1; j < outboundLegs.length; j++) {
      const A = outboundLegs[i];
      const B = outboundLegs[j];
      if (A.wpt.id !== B.wpt.id) continue;
      const gapMins = Math.abs(A.tZeroNorm - B.tZeroNorm);
      const gapNm = +(gapMins * SPEED_NM_PER_MIN).toFixed(1);
      if (gapMins < 5) {
        radialConflicts.push({
          pairLabel: `${A.icon} ${A.acft.callsign} & ${B.icon} ${B.acft.callsign}`,
          badgeText: `SAME OUTBOUND (${A.wpt.name})`,
          windowStr: `${gapNm} NM (${+gapMins.toFixed(1)}m) spacing`,
          detailText: `Both flying outbound (FROM AYT) on <strong>${A.wpt.name}</strong> with <strong>${gapNm} NM (${+gapMins.toFixed(
            1
          )} min)</strong> spacing (${A.acft.callsign}: ${A.altSummary} • ${B.acft.callsign}: ${
            B.altSummary
          }).`,
          isAlert: true,
        });
      }
    }
  }

  return {
    refHour,
    useHasHour,
    computedArrivals,
    computedDepartures,
    computedTransits,
    sequencedArrivals,
    eatMap,
    headOnConflicts,
    radialConflicts,
  };
}

// ============================================================================
// LIVE POSITION, ALTITUDE & SVG COORDINATE ESTIMATOR AT TIME T
// Supports Arrivals (ARR), Departures (DEP), and Transit (TRN) aircraft!
// ============================================================================
function polarToSvg(dmeNm, deg) {
  const rad = (deg * Math.PI) / 180;
  const rPx = dmeNm * PX_PER_NM;
  return {
    x: +(SVG_CENTER_X + rPx * Math.sin(rad)).toFixed(1),
    y: +(SVG_CENTER_Y - rPx * Math.cos(rad)).toFixed(1),
  };
}

function getAircraftStateAtTime(item, solverData, queryNormMins) {
  const { acft, calc } = item;

  // 1. TRANSIT AIRCRAFT ('TRN')
  if (acft.type === "TRN") {
    const { entryWpt, exitWpt } = item;
    const altStr = formatAltShort(calc.maintAltFt);

    if (queryNormMins < item.normInit) {
      const wait = +(item.normInit - queryNormMins).toFixed(1);
      return {
        visible: false,
        phase: "pending",
        dme: calc.dist,
        altFt: calc.maintAltFt,
        altStr,
        text: `Transit enters ${entryWpt.name} (${calc.dist} NM) in ${wait}m @ ${altStr}`,
        color: "var(--text-muted)",
      };
    }

    // Inbound leg TO AYT VOR
    if (calc.hasInbound && queryNormMins <= item.normVor) {
      const dme = Math.max(0, +((item.normVor - queryNormMins) * SPEED_NM_PER_MIN).toFixed(1));
      const pos = polarToSvg(dme, entryWpt.deg);
      const tip = polarToSvg(Math.max(0, dme - 4), entryWpt.deg);
      return {
        visible: dme <= 72,
        phase: "transit-in",
        x: pos.x,
        y: pos.y,
        tipX: tip.x,
        tipY: tip.y,
        dme,
        altFt: calc.maintAltFt,
        altStr,
        text: `${dme} NM TO AYT (${entryWpt.name} → ${exitWpt.name}) @ ${altStr}`,
        color: "#34d399",
      };
    }

    // Outbound leg FROM AYT VOR
    if (calc.hasOutbound) {
      const dme = +((queryNormMins - item.normVor) * SPEED_NM_PER_MIN).toFixed(1);
      if (dme <= 72) {
        const pos = polarToSvg(dme, exitWpt.deg);
        const tip = polarToSvg(Math.min(76, dme + 4), exitWpt.deg);
        return {
          visible: true,
          phase: "transit-out",
          x: pos.x,
          y: pos.y,
          tipX: tip.x,
          tipY: tip.y,
          dme,
          altFt: calc.maintAltFt,
          altStr,
          text: `${dme} NM FROM AYT (toward ${exitWpt.name}) @ ${altStr}`,
          color: "#34d399",
        };
      }
    }

    return {
      visible: false,
      phase: "exited",
      dme: 0,
      altFt: calc.maintAltFt,
      altStr,
      text: `Completed transit (${entryWpt.name} → ${exitWpt.name})`,
      color: "var(--text-muted)",
    };
  }

  // 2. DEPARTURE AIRCRAFT ('DEP')
  const { wpt } = item;
  if (acft.type === "DEP") {
    const tDep = item.normDep;
    if (queryNormMins < tDep) {
      const wait = +(tDep - queryNormMins).toFixed(1);
      return {
        visible: false,
        phase: "ground",
        dme: 0,
        altFt: 0,
        altStr: "GND",
        text: `On ground (Departs in ${wait}m)`,
        color: "var(--text-muted)",
      };
    }

    const elapsed = queryNormMins - tDep;
    const dme = +(elapsed * SPEED_NM_PER_MIN).toFixed(1);
    const currentAltFt =
      dme < 10 ? wpt.msaFt : dme < 25 ? Math.max(wpt.msaFt, wpt.meaFt) : calc.reqAltFt;

    const pos = polarToSvg(Math.min(dme, 72), wpt.deg);
    const tip = polarToSvg(Math.min(dme + 4, 76), wpt.deg);

    return {
      visible: dme <= 72,
      phase: "outbound",
      x: pos.x,
      y: pos.y,
      tipX: tip.x,
      tipY: tip.y,
      dme,
      altFt: currentAltFt,
      altStr: formatAltShort(currentAltFt),
      text: `${dme} NM FROM AYT on ${wpt.name} @ ${formatAltShort(currentAltFt)}`,
      color: "#fbbf24",
    };
  }

  // 3. ARRIVAL AIRCRAFT ('ARR')
  const eatInfo = solverData.eatMap.get(acft.id);
  const tInit = item.normInit;
  const d0 = calc.dist;

  if (queryNormMins < tInit) {
    const wait = +(tInit - queryNormMins).toFixed(1);
    return {
      visible: false,
      phase: "pending",
      dme: d0,
      altFt: calc.initAltFt,
      altStr: formatAltShort(calc.initAltFt),
      text: `Reports ${d0} NM in ${wait}m (@ ${formatAltShort(calc.initAltFt)})`,
      color: "var(--text-muted)",
    };
  }

  const currentAltFt =
    queryNormMins < (item.norm25 ?? tInit)
      ? wpt.meaFt
      : queryNormMins < item.norm10
      ? calc.straightIn && !eatInfo.willDelay
        ? 3000
        : wpt.msaFt
      : 3000;

  // Straight-In Arrival Geometry
  if (calc.straightIn) {
    if (queryNormMins <= item.norm10) {
      const elapsed = queryNormMins - tInit;
      const dme = Math.max(10, +(d0 - elapsed * SPEED_NM_PER_MIN).toFixed(1));
      const pos = polarToSvg(dme, wpt.deg);
      const tip = polarToSvg(Math.max(0, dme - 4), wpt.deg);
      return {
        visible: true,
        phase: "inbound",
        x: pos.x,
        y: pos.y,
        tipX: tip.x,
        tipY: tip.y,
        dme,
        altFt: currentAltFt,
        altStr: formatAltShort(currentAltFt),
        text: `${dme} NM TO AYT ${wpt.name} (Str-In) @ ${formatAltShort(currentAltFt)}`,
        color: "#c084fc",
      };
    }

    if (queryNormMins <= eatInfo.effectiveEstNorm) {
      const pos = polarToSvg(10, wpt.deg);
      return {
        visible: true,
        phase: "hold",
        x: pos.x,
        y: pos.y,
        tipX: pos.x,
        tipY: pos.y,
        dme: 10,
        altFt: 4000,
        altStr: "4000' HLD",
        text: `10 NM (${wpt.name}) — Holding until EAT ${eatInfo.eatDisplay}`,
        color: "#34d399",
      };
    }

    const afterEst = +(queryNormMins - eatInfo.effectiveEstNorm).toFixed(1);
    if (afterEst <= 2) {
      const finalDme = Math.max(0, +(10 - afterEst * SPEED_NM_PER_MIN).toFixed(1));
      const pos = polarToSvg(finalDme, wpt.deg);
      const tip = polarToSvg(Math.max(0, finalDme - 3), wpt.deg);
      return {
        visible: true,
        phase: "twr",
        x: pos.x,
        y: pos.y,
        tipX: tip.x,
        tipY: tip.y,
        dme: finalDme,
        altFt: 1500,
        altStr: "TWR",
        text: `Established w/ TWR (${finalDme} NM final)`,
        color: "#34d399",
      };
    }

    return {
      visible: false,
      phase: "landed",
      dme: 0,
      altFt: 0,
      altStr: "LND",
      text: `Established ${afterEst}m ago (Landed)`,
      color: "var(--text-muted)",
    };
  }

  // Normal Arrival Geometry:
  if (queryNormMins <= item.normVor) {
    const elapsed = queryNormMins - tInit;
    const dme = Math.max(0, +(d0 - elapsed * SPEED_NM_PER_MIN).toFixed(1));
    const pos = polarToSvg(dme, wpt.deg);
    const tip = polarToSvg(Math.max(0, dme - 4), wpt.deg);
    return {
      visible: true,
      phase: "inbound",
      x: pos.x,
      y: pos.y,
      tipX: tip.x,
      tipY: tip.y,
      dme,
      altFt: currentAltFt,
      altStr: formatAltShort(currentAltFt),
      text: `${dme} NM TO AYT ${wpt.name} @ ${formatAltShort(currentAltFt)}`,
      color: "#38bdf8",
    };
  }

  const procDeg = state.activeRwy === "36" ? 170 : 350;

  if (queryNormMins <= item.normFixBase) {
    const outElapsed = queryNormMins - item.normVor;
    const dme = +(outElapsed * SPEED_NM_PER_MIN).toFixed(1);
    const pos = polarToSvg(dme, procDeg);
    const tip = polarToSvg(dme + 3.5, procDeg);
    return {
      visible: true,
      phase: "outbound-fix",
      x: pos.x,
      y: pos.y,
      tipX: tip.x,
      tipY: tip.y,
      dme,
      altFt: 4000,
      altStr: "4000'",
      text: `${dme} NM outbound to 10 DME FIX`,
      color: "#fbbf24",
    };
  }

  if (queryNormMins <= eatInfo.effectiveFixNorm) {
    const remHold = +(eatInfo.effectiveFixNorm - queryNormMins).toFixed(1);
    const pos = polarToSvg(10, procDeg);
    return {
      visible: true,
      phase: "hold",
      x: +(pos.x + 12).toFixed(1),
      y: +(pos.y + 8).toFixed(1),
      tipX: pos.x,
      tipY: pos.y,
      dme: 10,
      altFt: 4000,
      altStr: "4000' HLD",
      text: `HOLDING at 10 DME FIX (${remHold}m to EAT)`,
      color: "#f87171",
    };
  }

  if (queryNormMins <= eatInfo.effectiveEstNorm) {
    const turnProgress = (queryNormMins - eatInfo.effectiveFixNorm) / 5;
    const remTurn = +(eatInfo.effectiveEstNorm - queryNormMins).toFixed(1);
    const arcDme = 10 + 3 * Math.sin(turnProgress * Math.PI);
    const arcDeg = procDeg + 12 * Math.sin(turnProgress * Math.PI);
    const pos = polarToSvg(arcDme, arcDeg);
    const tip = polarToSvg(Math.max(0, arcDme - 3), procDeg);
    return {
      visible: true,
      phase: "turn",
      x: pos.x,
      y: pos.y,
      tipX: tip.x,
      tipY: tip.y,
      dme: +arcDme.toFixed(1),
      altFt: 3000,
      altStr: "3000' ILS",
      text: `In 5-min ILS turn (${remTurn}m to Establish) @ 3,000'`,
      color: "#34d399",
    };
  }

  const afterEst = +(queryNormMins - eatInfo.effectiveEstNorm).toFixed(1);
  if (afterEst <= 2) {
    const finalDme = Math.max(0, +(10 - afterEst * SPEED_NM_PER_MIN).toFixed(1));
    const pos = polarToSvg(finalDme, procDeg);
    const tip = polarToSvg(Math.max(0, finalDme - 3), procDeg);
    return {
      visible: true,
      phase: "twr",
      x: pos.x,
      y: pos.y,
      tipX: tip.x,
      tipY: tip.y,
      dme: finalDme,
      altFt: 1500,
      altStr: "EST/TWR",
      text: `Established w/ TWR 118.1 (${finalDme} NM final)`,
      color: "#34d399",
    };
  }

  return {
    visible: false,
    phase: "landed",
    dme: 0,
    altFt: 0,
    altStr: "LND",
    text: `Established ${afterEst}m ago (Sent to TWR)`,
    color: "var(--text-muted)",
  };
}

// ============================================================================
// RENDER FUNCTIONS (WIZARD, ROUTE BUILDER, LIVE PREVIEW & TABLES)
// ============================================================================

function getWizardStepOrder(flightType) {
  if (flightType === "DEP") {
    // Departure prompt order: 0. Type -> 1. Callsign -> 2. FL -> 3. Time -> 4. WPT
    return ["TYPE", "CALLSIGN", "FL", "TIME", "WPT"];
  }
  // Arrival & Transit prompt order: 0. Type -> 1. Callsign -> 2. FL -> 3. Dist -> 4. WPT/Route -> 5. Report Time
  return ["TYPE", "CALLSIGN", "FL", "DIST", "WPT", "TIME"];
}

function renderTransitRouteChips() {
  const chipsEl = document.getElementById("transitRouteChips");
  if (!chipsEl) return;

  if (!state.transitRoute || state.transitRoute.length === 0) {
    chipsEl.innerHTML = `<span style="color:var(--text-muted);font-size:0.8rem;">Click Entry Waypoint below to start route...</span>`;
    return;
  }

  chipsEl.innerHTML = state.transitRoute
    .map((ptId, idx) => {
      const pt = getWaypointOrVor(ptId);
      const isVor = ptId === "AYT";
      const chip = `<span class="route-chip ${isVor ? "vor-chip" : ""}">${idx + 1}. ${
        pt.name
      }</span>`;
      return idx < state.transitRoute.length - 1
        ? `${chip} <span class="route-arrow">→</span>`
        : chip;
    })
    .join(" ");
}

function renderWaypointGrid() {
  const container = document.getElementById("wptGrid");
  const routeBuilderEl = document.getElementById("transitRouteBuilder");
  if (!container) return;
  container.innerHTML = "";

  const isTransit = state.flightType === "TRN";
  if (routeBuilderEl) {
    routeBuilderEl.classList.toggle("hidden", !isTransit);
    if (isTransit) renderTransitRouteChips();
  }

  // For Transit, include all 7 waypoints PLUS AYT VOR!
  const pointsList = isTransit ? ALL_ROUTE_POINTS : WAYPOINTS;

  pointsList.forEach((wpt) => {
    const isVor = wpt.id === "AYT";
    const isStraightForCurrentRwy =
      state.flightType === "ARR" && wpt.straightInRwy === state.activeRwy;
    const isSelected = isTransit
      ? state.transitRoute.includes(wpt.id)
      : state.selectedWpt === wpt.id;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `wpt-btn ${isSelected ? "active" : ""} ${
      isStraightForCurrentRwy ? "straight-in-capable" : ""
    } ${isVor ? "vor-special-btn" : ""}`;

    btn.innerHTML = isVor
      ? `
      <div class="wpt-name">
        <span>🎯 AYT VOR</span>
        <span class="wpt-entry-badge">0 NM</span>
      </div>
      <div class="wpt-meta">
        <span>TMA Center VOR</span>
        <span class="wpt-tag">VIA / OVER</span>
      </div>
    `
      : `
      <div class="wpt-name">
        <span>${wpt.name}</span>
        <span class="wpt-entry-badge">${wpt.entryWpt}</span>
      </div>
      <div class="wpt-meta">
        <span>MEA ${wpt.fl} • MSA ${wpt.msaFt / 1000}k</span>
        ${isStraightForCurrentRwy ? `<span class="wpt-tag">AUTO STR-IN</span>` : `<span>${wpt.radial}</span>`}
      </div>
    `;

    btn.addEventListener("click", () => {
      if (isTransit) {
        // Build Transit Route step-by-step:
        // If user already had a full 3-point route (Entry -> AYT -> Exit) and clicks a new outer WPT, start fresh with it as Entry
        if (state.transitRoute.length >= 3) {
          state.transitRoute = [wpt.id];
        } else if (state.transitRoute.length === 0) {
          state.transitRoute = [wpt.id];
        } else {
          const last = state.transitRoute[state.transitRoute.length - 1];
          if (last !== wpt.id) {
            // If first point is an outer waypoint and user clicks another outer waypoint directly,
            // automatically route via AYT VOR in between so the route is [Entry, AYT, Exit]!
            if (last !== "AYT" && wpt.id !== "AYT" && !state.transitRoute.includes("AYT")) {
              state.transitRoute.push("AYT", wpt.id);
            } else {
              state.transitRoute.push(wpt.id);
            }
          }
        }
        renderWaypointGrid();
        renderLivePreview();
        return;
      }

      state.selectedWpt = wpt.id;
      renderWaypointGrid();
      renderLivePreview();

      if (state.wizardOpen) {
        const steps = getWizardStepOrder(state.flightType);
        if (steps[state.wizardStepIdx] === "WPT") {
          if (state.flightType === "ARR") {
            state.wizardStepIdx++;
            if (typeof window.syncWizardUI === "function") window.syncWizardUI();
          } else {
            if (typeof window.syncWizardUI === "function") window.syncWizardUI(false);
            const actionBtn = document.getElementById("wizWptActionBtn");
            if (actionBtn) actionBtn.focus();
          }
        }
      }
    });

    container.appendChild(btn);
  });
}

function renderLivePreview() {
  const previewEl = document.getElementById("livePreview");
  if (!previewEl) return;

  const callsignLabel = state.inputCallsign.trim()
    ? state.inputCallsign.trim().toUpperCase()
    : state.flightType === "DEP"
    ? "DEP PREVIEW"
    : state.flightType === "TRN"
    ? "TRANSIT PREVIEW"
    : "ARR PREVIEW";

  // 1. TRANSIT PREVIEW
  if (state.flightType === "TRN") {
    const trnCalc = calculateTransitCheckpoints({
      route: state.transitRoute,
      dist: state.selectedDist,
      timeRaw: state.inputTimeRaw,
      fl: state.selectedFl,
      queryDme: state.globalQueryDme,
    });

    const routeStr = `${trnCalc.entryWpt.name} → AYT VOR → ${trnCalc.exitWpt.name}`;

    previewEl.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">
          <span class="badge badge-trn">✈️ TRANSIT TRAFFIC</span>
          <span><strong>${callsignLabel}</strong> • Route: <strong>${routeStr}</strong> • Maintains <strong>${formatAlt(
      trnCalc.maintAltFt
    )}</strong></span>
        </div>
        <span class="step-delta">${state.globalQueryDme} NM: TO AYT <strong>${formatTime(
      trnCalc.tQueryTo,
      trnCalc.hasHour
    )}</strong> • FROM AYT <strong>${formatTime(trnCalc.tQueryFrom, trnCalc.hasHour)}</strong></span>
      </div>
      <div class="preview-steps">
        <div class="step-box">
          <div class="step-label"><span>INIT (${trnCalc.dist} NM TO)</span> <span class="step-delta">${
      trnCalc.entryWpt.name
    }</span></div>
          <div class="step-time">${formatTime(trnCalc.tInit, trnCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>25 NM TO</span> <span class="step-delta">INB</span></div>
          <div class="step-time">${formatTime(trnCalc.t25To, trnCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>10 NM TO</span> <span class="step-delta">INB</span></div>
          <div class="step-time">${formatTime(trnCalc.t10To, trnCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>AYT VOR</span> <span class="step-delta">0 NM</span></div>
          <div class="step-time">${formatTime(trnCalc.tVor, trnCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>10 NM FROM</span> <span class="step-delta">${
      trnCalc.exitWpt.name
    }</span></div>
          <div class="step-time">${formatTime(trnCalc.t10From, trnCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>25 NM FROM</span> <span class="step-delta">OUTB</span></div>
          <div class="step-time">${formatTime(trnCalc.t25From, trnCalc.hasHour)}</div>
        </div>
      </div>
    `;
    return;
  }

  const wptObj = WAYPOINTS.find((w) => w.id === state.selectedWpt) || WAYPOINTS[0];

  // 2. DEPARTURE PREVIEW
  if (state.flightType === "DEP") {
    const depCalc = calculateDepartureCheckpoints({
      wptId: state.selectedWpt,
      timeRaw: state.inputTimeRaw,
      fl: state.selectedFl,
      queryDme: state.globalQueryDme,
    });

    previewEl.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">
          <span class="badge badge-dep">🛫 OUTBOUND DEPARTURE</span>
          <span><strong>${callsignLabel}</strong> → <strong>${wptObj.name} (${wptObj.entryWpt})</strong> • Req ${formatAlt(
      depCalc.reqAltFt
    )}</span>
        </div>
        <span class="step-delta">${depCalc.qDme} NM FROM AYT @ <strong>${formatTime(
      depCalc.tQueryFrom,
      depCalc.hasHour
    )}</strong></span>
      </div>
      <div class="preview-steps dep-steps">
        <div class="step-box">
          <div class="step-label"><span>0 NM (DEP)</span> <span class="step-delta">GND</span></div>
          <div class="step-time">${formatTime(depCalc.tDep, depCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>10 NM</span> <span class="step-delta">≥${formatAltShort(
            wptObj.msaFt
          )}</span></div>
          <div class="step-time">${formatTime(depCalc.t10, depCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>25 NM</span> <span class="step-delta">≥${formatAltShort(
            wptObj.meaFt
          )}</span></div>
          <div class="step-time">${formatTime(depCalc.t25, depCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>50 NM</span> <span class="step-delta">${formatAltShort(
            depCalc.reqAltFt
          )}</span></div>
          <div class="step-time">${formatTime(depCalc.t50, depCalc.hasHour)}</div>
        </div>
        <div class="step-box">
          <div class="step-label"><span>60 NM</span> <span class="step-delta">+12m</span></div>
          <div class="step-time">${formatTime(depCalc.t60, depCalc.hasHour)}</div>
        </div>
      </div>
    `;
    return;
  }

  // 3. ARRIVAL PREVIEW
  const calc = calculateArrivalCheckpoints(
    {
      wptId: state.selectedWpt,
      dist: state.selectedDist,
      timeRaw: state.inputTimeRaw,
      mode: "auto",
      holdMins: 0,
      fl: state.selectedFl,
      queryDme: state.globalQueryDme,
    },
    state.activeRwy
  );

  previewEl.innerHTML = `
    <div class="preview-header">
      <div class="preview-title">
        <span class="badge ${calc.straightIn ? "badge-straight" : "badge-normal"}">
          ${calc.straightIn ? `⚡ STRAIGHT-IN (RWY ${state.activeRwy})` : `📐 NORMAL (RWY ${state.activeRwy})`}
        </span>
        <span><strong>${callsignLabel}</strong> via <strong>${wptObj.name} (${wptObj.entryWpt})</strong> • Entry ${formatAlt(
    calc.initAltFt
  )} → MEA ${formatAlt(wptObj.meaFt)} → MSA ${formatAlt(wptObj.msaFt)}</span>
      </div>
      <span class="step-delta">${calc.qDme} NM TO AYT @ <strong>${formatTime(
    calc.tQueryTo,
    calc.hasHour
  )}</strong></span>
    </div>
    <div class="preview-steps">
      <div class="step-box">
        <div class="step-label"><span>INIT (${calc.dist} NM)</span> <span class="step-delta">→${formatAltShort(
    wptObj.meaFt
  )}</span></div>
        <div class="step-time">${formatTime(calc.tInit, calc.hasHour)}</div>
      </div>
      <div class="step-box">
        <div class="step-label"><span>25 NM</span> <span class="step-delta">→${formatAltShort(
          wptObj.msaFt
        )}</span></div>
        <div class="step-time">${formatTime(calc.t25, calc.hasHour)}</div>
      </div>
      <div class="step-box">
        <div class="step-label"><span>10 NM</span> <span class="step-delta">→3000'</span></div>
        <div class="step-time">${formatTime(calc.t10, calc.hasHour)}</div>
      </div>
      <div class="step-box ${calc.straightIn ? "step-bypassed" : ""}">
        <div class="step-label"><span>AYT VOR</span></div>
        <div class="step-time">${calc.straightIn ? "—" : formatTime(calc.tVor, calc.hasHour)}</div>
      </div>
      <div class="step-box ${calc.straightIn ? "step-bypassed" : ""}">
        <div class="step-label"><span>10 DME FIX</span></div>
        <div class="step-time">${calc.straightIn ? "—" : formatTime(calc.tFix, calc.hasHour)}</div>
      </div>
      <div class="step-box">
        <div class="step-label"><span>ESTABLISHED</span></div>
        <div class="step-time">${formatTime(calc.tEst, calc.hasHour)}</div>
      </div>
    </div>
  `;
}

function buildWaypointOptionsHtml(selectedWptId, includeVor = false) {
  const list = includeVor ? ALL_ROUTE_POINTS : WAYPOINTS;
  return list
    .map(
      (w) =>
        `<option value="${w.id}" ${w.id === selectedWptId ? "selected" : ""}>${w.name} (${w.entryWpt})</option>`
    )
    .join("");
}

// Refresh calculated values in-place without losing input focus
function refreshCalculatedValuesOnly() {
  const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);

  solver.computedArrivals.forEach(({ acft, calc }) => {
    const tr = document.querySelector(`tr[data-row-id="${acft.id}"]`);
    if (!tr) return;

    const eatInfo = solver.eatMap.get(acft.id);
    const modeBadge = tr.querySelector("[data-mode-badge]");
    if (modeBadge) {
      modeBadge.className = `badge ${calc.straightIn ? "badge-straight" : "badge-normal"}`;
      modeBadge.textContent = calc.straightIn ? "STR-IN" : "NORMAL";
    }

    const setCell = (col, val) => {
      const el = tr.querySelector(`[data-col="${col}"]`);
      if (el) el.innerHTML = val;
    };

    setCell("t25", formatTime(calc.t25, calc.hasHour));
    setCell("t15", formatTime(calc.t15, calc.hasHour));
    setCell("t10", formatTime(calc.t10, calc.hasHour));
    setCell(
      "tVor",
      calc.straightIn ? `<span style="color:var(--text-muted)">—</span>` : formatTime(calc.tVor, calc.hasHour)
    );
    setCell(
      "tFix",
      calc.straightIn ? `<span style="color:var(--text-muted)">—</span>` : eatInfo.effectiveFixDisplay
    );
    setCell("tEat", eatInfo.eatDisplay);
    setCell("tEst", eatInfo.effectiveEstDisplay);
    setCell("dmeTo", `TO AYT: ${formatTime(calc.tQueryTo, calc.hasHour)}`);
    setCell(
      "willDelay",
      eatInfo.willDelay
        ? `<span class="badge ${eatInfo.autoHoldMins > 0 ? "badge-delayed" : "badge-eat"}">${
            eatInfo.autoHoldMins > 0 ? `HOLD ${eatInfo.autoHoldMins}m` : "EAT DELAY"
          }</span>`
        : `<span class="badge badge-nodelay">ON TIME</span>`
    );
  });

  solver.computedDepartures.forEach(({ acft, calc }) => {
    const tr = document.querySelector(`tr[data-row-id="${acft.id}"]`);
    if (!tr) return;

    const setCell = (col, val) => {
      const el = tr.querySelector(`[data-col="${col}"]`);
      if (el) el.textContent = val;
    };

    setCell("dep10", formatTime(calc.t10, calc.hasHour));
    setCell("dep25", formatTime(calc.t25, calc.hasHour));
    setCell("dep50", formatTime(calc.t50, calc.hasHour));
    setCell("dep60", formatTime(calc.t60, calc.hasHour));
    setCell("dmeFrom", `FROM AYT: ${formatTime(calc.tQueryFrom, calc.hasHour)}`);
  });

  solver.computedTransits.forEach(({ acft, calc }) => {
    const tr = document.querySelector(`tr[data-row-id="${acft.id}"]`);
    if (!tr) return;

    const setCell = (col, val) => {
      const el = tr.querySelector(`[data-col="${col}"]`);
      if (el) el.innerHTML = val;
    };

    setCell("trn25To", formatTime(calc.t25To, calc.hasHour));
    setCell("trn10To", formatTime(calc.t10To, calc.hasHour));
    setCell("trnVor", formatTime(calc.tVor, calc.hasHour));
    setCell("trn10From", formatTime(calc.t10From, calc.hasHour));
    setCell("trn25From", formatTime(calc.t25From, calc.hasHour));
    setCell("trn50From", formatTime(calc.t50From, calc.hasHour));
    setCell("trnDmeTo", `TO: ${formatTime(calc.tQueryTo, calc.hasHour)}`);
    setCell("trnDmeFrom", `FROM: ${formatTime(calc.tQueryFrom, calc.hasHour)}`);
  });

  renderConflictPanels(solver);
  renderRadarChartView(solver);
}

// Render Scenario Sheet + Conflict Finder + Chart
function renderScenarioBoard() {
  const arrTbody = document.getElementById("scenarioTableBody");
  const depSection = document.getElementById("departuresSection");
  const depTbody = document.getElementById("departuresTableBody");
  const trnSection = document.getElementById("transitSection");
  const trnTbody = document.getElementById("transitTableBody");
  const summaryText = document.getElementById("scenarioSummaryText");

  const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
  const { computedArrivals, computedDepartures, computedTransits, eatMap } = solver;

  summaryText.textContent = `${computedArrivals.length} Arrival(s), ${computedDepartures.length} Departure(s), ${computedTransits.length} Transit(s) • All fields & DME crossing queries editable.`;

  // 1. Arrivals Table
  if (computedArrivals.length === 0) {
    arrTbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="17">No arriving aircraft added yet.</td>
      </tr>
    `;
  } else {
    arrTbody.innerHTML = "";
    computedArrivals.forEach(({ acft, calc }) => {
      const eatInfo = eatMap.get(acft.id);
      const tr = document.createElement("tr");
      tr.setAttribute("data-row-id", acft.id);

      tr.innerHTML = `
        <td>
          <input
            type="text"
            class="inline-input inline-callsign"
            data-edit-field="callsign"
            data-id="${acft.id}"
            value="${acft.callsign}"
            maxlength="12"
          />
        </td>
        <td>
          <select
            class="inline-select inline-wpt"
            data-edit-field="wptId"
            data-id="${acft.id}"
          >
            ${buildWaypointOptionsHtml(acft.wptId, false)}
          </select>
        </td>
        <td>
          <input
            type="number"
            class="inline-input inline-fl"
            data-edit-field="fl"
            data-id="${acft.id}"
            value="${acft.fl || 130}"
            step="10"
            title="Initial Flight Level"
          />
        </td>
        <td>
          <span class="badge ${
            calc.straightIn ? "badge-straight" : "badge-normal"
          }" data-mode-badge="${acft.id}" title="Automatic Approach Mode based on Active Runway">
            ${calc.straightIn ? "STR-IN" : "NORMAL"}
          </span>
        </td>
        <td>
          <input
            type="number"
            class="inline-input inline-dist"
            data-edit-field="dist"
            data-id="${acft.id}"
            value="${calc.dist}"
            min="5"
            max="150"
            step="1"
          />
        </td>
        <td>
          <input
            type="text"
            class="inline-input inline-time"
            data-edit-field="timeRaw"
            data-id="${acft.id}"
            value="${acft.timeRaw}"
          />
        </td>
        <td class="time-cell" data-col="t25">${formatTime(calc.t25, calc.hasHour)}</td>
        <td class="time-cell" data-col="t15">${formatTime(calc.t15, calc.hasHour)}</td>
        <td class="time-cell" data-col="t10">${formatTime(calc.t10, calc.hasHour)}</td>
        <td class="time-cell" data-col="tVor">${
          calc.straightIn ? `<span style="color:var(--text-muted)">—</span>` : formatTime(calc.tVor, calc.hasHour)
        }</td>
        <td class="time-cell" data-col="tFix">${
          calc.straightIn ? `<span style="color:var(--text-muted)">—</span>` : eatInfo.effectiveFixDisplay
        }</td>
        <td class="time-cell eat-cell" data-col="tEat">${eatInfo.eatDisplay}</td>
        <td class="time-cell" data-col="tEst">${eatInfo.effectiveEstDisplay}</td>
        <td>
          <div class="dme-cross-cell">
            <input
              type="number"
              class="inline-input inline-query-dme"
              data-edit-field="queryDme"
              data-id="${acft.id}"
              value="${calc.qDme}"
              min="0"
              max="150"
              step="0.5"
              title="Distance TO AYT VOR (NM)"
            />
            <span class="dme-single-res" data-col="dmeTo">TO AYT: ${formatTime(
              calc.tQueryTo,
              calc.hasHour
            )}</span>
          </div>
        </td>
        <td data-col="willDelay">
          ${
            eatInfo.willDelay
              ? `<span class="badge ${eatInfo.autoHoldMins > 0 ? "badge-delayed" : "badge-eat"}">${
                  eatInfo.autoHoldMins > 0 ? `HOLD ${eatInfo.autoHoldMins}m` : "EAT DELAY"
                }</span>`
              : `<span class="badge badge-nodelay">ON TIME</span>`
          }
        </td>
        <td>
          <div class="hold-controls">
            <button type="button" class="hold-btn" data-hold-id="${acft.id}" data-hold-delta="-1">-1</button>
            <input
              type="number"
              class="inline-input inline-hold"
              data-edit-field="holdMins"
              data-id="${acft.id}"
              value="${calc.holdMins}"
              step="1"
            />
            <button type="button" class="hold-btn" data-hold-id="${acft.id}" data-hold-delta="1">+1</button>
          </div>
        </td>
        <td>
          <button type="button" class="row-del-btn" data-del-id="${acft.id}" title="Remove aircraft">✕</button>
        </td>
      `;

      arrTbody.appendChild(tr);
    });
  }

  // 2. Departures Sub-Table
  if (computedDepartures.length === 0) {
    depSection.classList.add("hidden");
    depTbody.innerHTML = "";
  } else {
    depSection.classList.remove("hidden");
    depTbody.innerHTML = "";
    computedDepartures.forEach(({ acft, calc }) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-row-id", acft.id);
      tr.innerHTML = `
        <td>
          <input
            type="text"
            class="inline-input inline-callsign"
            data-edit-field="callsign"
            data-id="${acft.id}"
            value="${acft.callsign}"
            maxlength="12"
          />
        </td>
        <td>
          <select
            class="inline-select inline-wpt"
            data-edit-field="wptId"
            data-id="${acft.id}"
          >
            ${buildWaypointOptionsHtml(acft.wptId, false)}
          </select>
        </td>
        <td>
          <input
            type="number"
            class="inline-input inline-fl"
            data-edit-field="fl"
            data-id="${acft.id}"
            value="${acft.fl || 140}"
            step="10"
            title="Requested Flight Level"
          />
        </td>
        <td>
          <input
            type="text"
            class="inline-input inline-time"
            data-edit-field="timeRaw"
            data-id="${acft.id}"
            value="${acft.timeRaw}"
          />
        </td>
        <td class="time-cell" data-col="dep10">${formatTime(calc.t10, calc.hasHour)}</td>
        <td class="time-cell" data-col="dep25">${formatTime(calc.t25, calc.hasHour)}</td>
        <td class="time-cell" data-col="dep50">${formatTime(calc.t50, calc.hasHour)}</td>
        <td class="time-cell" data-col="dep60">${formatTime(calc.t60, calc.hasHour)}</td>
        <td>
          <div class="dme-cross-cell">
            <input
              type="number"
              class="inline-input inline-query-dme"
              data-edit-field="queryDme"
              data-id="${acft.id}"
              value="${calc.qDme}"
              min="0"
              max="150"
              step="0.5"
              title="Distance FROM AYT VOR (NM)"
            />
            <span class="dme-single-res from-res" data-col="dmeFrom">FROM AYT: ${formatTime(
              calc.tQueryFrom,
              calc.hasHour
            )}</span>
          </div>
        </td>
        <td>
          <button type="button" class="row-del-btn" data-del-id="${acft.id}" title="Remove departure">✕</button>
        </td>
      `;
      depTbody.appendChild(tr);
    });
  }

  // 3. Transit Sub-Table
  if (computedTransits.length === 0) {
    trnSection.classList.add("hidden");
    trnTbody.innerHTML = "";
  } else {
    trnSection.classList.remove("hidden");
    trnTbody.innerHTML = "";
    computedTransits.forEach(({ acft, calc }) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-row-id", acft.id);
      tr.innerHTML = `
        <td>
          <input
            type="text"
            class="inline-input inline-callsign"
            data-edit-field="callsign"
            data-id="${acft.id}"
            value="${acft.callsign}"
            maxlength="12"
          />
        </td>
        <td>
          <div class="inline-route-wrap">
            <select
              class="inline-select inline-wpt"
              data-edit-field="entryWptId"
              data-id="${acft.id}"
              title="Entry Waypoint (TO AYT)"
            >
              ${buildWaypointOptionsHtml(calc.entryWptId, true)}
            </select>
            <span class="inline-route-vor">→ AYT VOR →</span>
            <select
              class="inline-select inline-wpt"
              data-edit-field="exitWptId"
              data-id="${acft.id}"
              title="Exit Waypoint (FROM AYT)"
            >
              ${buildWaypointOptionsHtml(calc.exitWptId, true)}
            </select>
          </div>
        </td>
        <td>
          <input
            type="number"
            class="inline-input inline-fl"
            data-edit-field="fl"
            data-id="${acft.id}"
            value="${acft.fl || 150}"
            step="10"
            title="Maintained Flight Level"
          />
        </td>
        <td>
          <input
            type="number"
            class="inline-input inline-dist"
            data-edit-field="dist"
            data-id="${acft.id}"
            value="${calc.dist}"
            min="0"
            max="150"
            step="1"
          />
        </td>
        <td>
          <input
            type="text"
            class="inline-input inline-time"
            data-edit-field="timeRaw"
            data-id="${acft.id}"
            value="${acft.timeRaw}"
          />
        </td>
        <td class="time-cell" data-col="trn25To">${formatTime(calc.t25To, calc.hasHour)}</td>
        <td class="time-cell" data-col="trn10To">${formatTime(calc.t10To, calc.hasHour)}</td>
        <td class="time-cell eat-cell" data-col="trnVor">${formatTime(calc.tVor, calc.hasHour)}</td>
        <td class="time-cell" data-col="trn10From">${formatTime(calc.t10From, calc.hasHour)}</td>
        <td class="time-cell" data-col="trn25From">${formatTime(calc.t25From, calc.hasHour)}</td>
        <td class="time-cell" data-col="trn50From">${formatTime(calc.t50From, calc.hasHour)}</td>
        <td>
          <div class="dme-cross-cell">
            <input
              type="number"
              class="inline-input inline-query-dme"
              data-edit-field="queryDme"
              data-id="${acft.id}"
              value="${calc.qDme}"
              min="0"
              max="150"
              step="0.5"
              title="Distance TO & FROM AYT VOR (NM)"
            />
            <div class="dme-dual-res">
              <span class="dme-mini-tag to-tag" data-col="trnDmeTo">TO: ${formatTime(
                calc.tQueryTo,
                calc.hasHour
              )}</span>
              <span class="dme-mini-tag from-tag" data-col="trnDmeFrom">FROM: ${formatTime(
                calc.tQueryFrom,
                calc.hasHour
              )}</span>
            </div>
          </div>
        </td>
        <td>
          <button type="button" class="row-del-btn" data-del-id="${acft.id}" title="Remove transit">✕</button>
        </td>
      `;
      trnTbody.appendChild(tr);
    });
  }

  // Wire up inline editable fields across all 3 tables
  document.querySelectorAll("[data-edit-field]").forEach((inputEl) => {
    const field = inputEl.getAttribute("data-edit-field");
    const id = Number(inputEl.getAttribute("data-id"));

    const handleUpdate = () => {
      const target = state.aircraftList.find((a) => a.id === id);
      if (!target) return;

      if (field === "callsign") {
        target.callsign = inputEl.value.toUpperCase();
      } else if (field === "wptId") {
        target.wptId = inputEl.value;
      } else if (field === "entryWptId") {
        target.entryWptId = inputEl.value;
        target.route = [target.entryWptId, "AYT", target.exitWptId || "DERYA"];
      } else if (field === "exitWptId") {
        target.exitWptId = inputEl.value;
        target.route = [target.entryWptId || "KUMRU", "AYT", target.exitWptId];
      } else if (field === "fl") {
        target.fl = Number(inputEl.value) || 100;
      } else if (field === "dist") {
        target.dist = Number(inputEl.value) || 0;
      } else if (field === "timeRaw") {
        target.timeRaw = inputEl.value;
      } else if (field === "holdMins") {
        target.holdMins = Number(inputEl.value) || 0;
      } else if (field === "queryDme") {
        target.queryDme = inputEl.value === "" ? 0 : Number(inputEl.value);
      }

      saveState();
      refreshCalculatedValuesOnly();
    };

    inputEl.addEventListener("input", handleUpdate);
    inputEl.addEventListener("change", handleUpdate);
  });

  document.querySelectorAll("[data-del-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-del-id"));
      state.aircraftList = state.aircraftList.filter((a) => a.id !== id);
      saveState();
      renderScenarioBoard();
    });
  });

  arrTbody.querySelectorAll("[data-hold-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-hold-id"));
      const delta = Number(btn.getAttribute("data-hold-delta"));
      const target = state.aircraftList.find((a) => a.id === id);
      if (target) {
        target.holdMins = (target.holdMins || 0) + delta;
        saveState();
        renderScenarioBoard();
      }
    });
  });

  renderConflictPanels(solver);
  renderRadarChartView(solver);
}

// Render the 3 Conflict Finder Panels (Head-On, Radial/<15 NM VOR, and Approach Sequence/EAT)
function renderConflictPanels(solver) {
  const depArrListEl = document.getElementById("depArrConflictList");
  const radialConflictListEl = document.getElementById("radialConflictList");
  const ilsDelayListEl = document.getElementById("ilsDelayList");

  // 1. Head-On Conflicts (Same Waypoint — ARR / DEP / TRN)
  if (solver.headOnConflicts.length === 0) {
    depArrListEl.innerHTML = `
      <div class="conflict-box">
        <div class="conflict-detail">
          No Head-On opposite-direction traffic pairs on the same waypoint.
        </div>
      </div>
    `;
  } else {
    depArrListEl.innerHTML = "";
    solver.headOnConflicts.forEach((c) => {
      const box = document.createElement("div");
      if (c.isValidInboundConflict) {
        box.className = "conflict-box alert-danger";
        box.innerHTML = `
          <div class="conflict-top">
            <span class="conflict-pair">${c.outLeg.icon} ${c.outLeg.acft.callsign} ↔ ${c.inLeg.icon} ${c.inLeg.acft.callsign}</span>
            <span class="badge badge-delayed">${c.wpt.name} (${c.zone})</span>
          </div>
          <div class="conflict-metrics">
            <div class="metric-pill where-pill">📍 WHERE: <strong>${c.dCross} NM (${c.wpt.name})</strong></div>
            <div class="metric-pill when-pill">⏰ WHEN: <strong>${c.displayTime}</strong></div>
          </div>
          <div class="conflict-detail" style="color:var(--text-main);">
            ${c.conflictNote}
          </div>
        `;
      } else {
        box.className = "conflict-box alert-safe";
        box.innerHTML = `
          <div class="conflict-top">
            <span class="conflict-pair">${c.outLeg.icon} ${c.outLeg.acft.callsign} ↔ ${c.inLeg.icon} ${c.inLeg.acft.callsign}</span>
            <span class="badge badge-nodelay">${c.wpt.name} — CLEAR</span>
          </div>
          <div class="conflict-detail">
            No head-on radial crossing within the active TMA segment.
          </div>
        `;
      }
      depArrListEl.appendChild(box);
    });
  }

  // 2. Radial, Same-Direction & <15 NM AYT VOR Conflicts
  if (radialConflictListEl) {
    radialConflictListEl.innerHTML = "";
    const radList = solver.radialConflicts || [];

    if (radList.length === 0) {
      radialConflictListEl.innerHTML = `
        <div class="conflict-box">
          <div class="conflict-detail">
            No cross-radial &lt;15 NM VOR or same-corridor spacing conflicts detected.
          </div>
        </div>
      `;
    } else {
      radList.forEach((rc) => {
        const box = document.createElement("div");
        box.className = `conflict-box ${rc.isAlert ? "alert-warn" : "alert-safe"}`;
        box.innerHTML = `
          <div class="conflict-top">
            <span class="conflict-pair">${rc.pairLabel}</span>
            <span class="badge badge-eat">${rc.badgeText}</span>
          </div>
          <div class="conflict-metrics">
            <div class="metric-pill when-pill">⏰ WINDOW / SPACING: <strong>${rc.windowStr}</strong></div>
          </div>
          <div class="conflict-detail" style="color:var(--text-main);">
            ${rc.detailText}
          </div>
        `;
        radialConflictListEl.appendChild(box);
      });
    }
  }

  // 3. Approach Sequence & EAT Delays
  ilsDelayListEl.innerHTML = "";
  const delayedArrs = solver.sequencedArrivals.filter(
    (item) => solver.eatMap.get(item.acft.id)?.willDelay
  );
  if (solver.sequencedArrivals.length === 0) {
    ilsDelayListEl.innerHTML = `
      <div class="conflict-box">
        <div class="conflict-detail">Add arriving aircraft to see approach sequencing and EAT calculations.</div>
      </div>
    `;
  } else if (delayedArrs.length === 0) {
    ilsDelayListEl.innerHTML = `
      <div class="conflict-box alert-safe">
        <div class="conflict-top">
          <span class="conflict-pair">✅ All Arrivals On Time</span>
          <span class="badge badge-nodelay">NO EAT DELAY</span>
        </div>
        <div class="conflict-detail">
          Every arriving aircraft reaches its ILS clearance point after the preceding aircraft is already Established.
        </div>
      </div>
    `;
  } else {
    delayedArrs.forEach((item) => {
      const eatInfo = solver.eatMap.get(item.acft.id);
      const box = document.createElement("div");
      box.className = "conflict-box alert-danger";

      box.innerHTML = `
        <div class="conflict-top">
          <span class="conflict-pair">⏳ ${item.acft.callsign} (${item.wpt.name}) — EAT: ${eatInfo.eatDisplay}</span>
          <span class="badge badge-delayed">${
            eatInfo.autoHoldMins > 0 ? `HOLDS ${eatInfo.autoHoldMins}m` : "NO HOLD NEEDED"
          }</span>
        </div>
        <div class="conflict-detail" style="color:var(--text-main);">
          Reaches ILS clearance point at <code>${formatTime(
            item.calc.tClearBase,
            item.calc.hasHour
          )}</code>, while <strong>#${eatInfo.seqNum - 1} ${
        eatInfo.blockedBy.acft.callsign
      }</strong> is not established until <code>${eatInfo.eatDisplay}</code>.<br/>
          → <strong>EAT = ${eatInfo.eatDisplay}</strong> (${
        eatInfo.clearancePhaseNote
      }) → Established at <code>${eatInfo.effectiveEstDisplay}</code>.
        </div>
      `;
      ilsDelayListEl.appendChild(box);
    });
  }
}

// ============================================================================
// VIEW 2: STATIC SVG CORRIDORS + DYNAMIC LIVE AIRCRAFT BLIPS
// ============================================================================
function renderStaticSvgCorridors() {
  const layer = document.getElementById("svgCorridorsLayer");
  if (!layer) return;
  layer.innerHTML = "";

  WAYPOINTS.forEach((wpt) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "chart-corridor");
    g.setAttribute("data-wpt", wpt.id);

    const pOuter = polarToSvg(72, wpt.deg);
    const pTma = polarToSvg(50, wpt.deg);
    const pVorEdge = polarToSvg(6, wpt.deg);
    const pLabelOuter = polarToSvg(80, wpt.deg);
    const pLabelMain = polarToSvg(54, wpt.deg + 7);
    const pSpec = polarToSvg(62, wpt.deg - 5);

    g.innerHTML = `
      <line x1="${pOuter.x}" y1="${pOuter.y}" x2="${pTma.x}" y2="${pTma.y}" class="airway-dashed" />
      <line x1="${pTma.x}" y1="${pTma.y}" x2="${pVorEdge.x}" y2="${pVorEdge.y}" class="inbound-track" marker-end="url(#arrowRed)" />
      <polygon points="${pOuter.x},${pOuter.y - 6} ${pOuter.x - 5},${pOuter.y + 4} ${pOuter.x + 5},${pOuter.y + 4}" class="wpt-triangle-outer" />
      <text x="${pLabelOuter.x}" y="${pLabelOuter.y}" class="chart-wpt-outer">${wpt.entryWpt}</text>
      <polygon points="${pTma.x},${pTma.y - 6} ${pTma.x - 5},${pTma.y + 4} ${pTma.x + 5},${pTma.y + 4}" class="wpt-triangle" />
      <text x="${pLabelMain.x}" y="${pLabelMain.y}" class="chart-wpt-main">${wpt.name}</text>
      <text x="${pSpec.x}" y="${pSpec.y}" class="chart-spec">${wpt.radial} • ${wpt.fl}</text>
    `;

    layer.appendChild(g);
  });
}

function getRectPerimeterAnchor(px, py, rx, ry, rw, rh) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = px - cx;
  const dy = py - cy;
  if (dx === 0 && dy === 0) return { x: rx, y: cy };

  const halfW = rw / 2;
  const halfH = rh / 2;
  const scaleX = Math.abs(dx) > 0.001 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0.001 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: +(cx + dx * scale).toFixed(1),
    y: +(cy + dy * scale).toFixed(1),
  };
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, pad = 8) {
  return (
    ax < bx + bw + pad &&
    ax + aw + pad > bx &&
    ay < by + bh + pad &&
    ay + ah + pad > by
  );
}

function segmentsIntersect(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const ccw = (ax, ay, bx, by, cx, cy) =>
    (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  return (
    ccw(p1x, p1y, p3x, p3y, p4x, p4y) !== ccw(p2x, p2y, p3x, p3y, p4x, p4y) &&
    ccw(p1x, p1y, p2x, p2y, p3x, p3y) !== ccw(p1x, p1y, p2x, p2y, p4x, p4y)
  );
}

function computeNonOverlappingTagPositions(visibleBlips) {
  const TAG_W = 88;
  const TAG_H = 30;
  const PAD = 8;
  const BLIP_CLEARANCE = 14;
  const MIN_X = 10;
  const MAX_X = 850 - TAG_W;
  const MIN_Y = 10;
  const MAX_Y = 850 - TAG_H;

  const placedTags = [];
  const angleSteps = [
    0, 25, -25, 50, -50, 75, -75, 100, -100, 125, -125, 150, -150, 180,
  ];
  const radii = [46, 68, 92, 118, 146, 176, 210];

  visibleBlips.forEach((b, idx) => {
    const dxCenter = b.x - SVG_CENTER_X;
    const dyCenter = b.y - SVG_CENTER_Y;
    const baseAngleRad =
      Math.hypot(dxCenter, dyCenter) > 8
        ? Math.atan2(dyCenter, dxCenter)
        : (idx * (2 * Math.PI)) / Math.max(1, visibleBlips.length) - Math.PI / 4;

    let bestCandidate = null;
    let bestScore = Infinity;

    for (const r of radii) {
      for (const aDeg of angleSteps) {
        const ang = baseAngleRad + (aDeg * Math.PI) / 180;
        const centerX = b.x + r * Math.cos(ang);
        const centerY = b.y + r * Math.sin(ang);
        const tx = Math.max(MIN_X, Math.min(MAX_X, centerX - TAG_W / 2));
        const ty = Math.max(MIN_Y, Math.min(MAX_Y, centerY - TAG_H / 2));

        let overlapsTag = false;
        for (const pt of placedTags) {
          if (rectsOverlap(tx, ty, TAG_W, TAG_H, pt.tx, pt.ty, TAG_W, TAG_H, PAD)) {
            overlapsTag = true;
            break;
          }
        }
        if (overlapsTag) continue;

        let overlapsBlip = false;
        for (const otherBlip of visibleBlips) {
          if (
            rectsOverlap(
              tx,
              ty,
              TAG_W,
              TAG_H,
              otherBlip.x - 6,
              otherBlip.y - 6,
              12,
              12,
              BLIP_CLEARANCE
            )
          ) {
            overlapsBlip = true;
            break;
          }
        }
        if (overlapsBlip) continue;

        const anchor = getRectPerimeterAnchor(b.x, b.y, tx, ty, TAG_W, TAG_H);
        let lineCrossPenalty = 0;
        for (const pt of placedTags) {
          if (
            segmentsIntersect(
              b.x,
              b.y,
              anchor.x,
              anchor.y,
              pt.bx,
              pt.by,
              pt.anchorX,
              pt.anchorY
            )
          ) {
            lineCrossPenalty += 400;
          }
        }

        const distScore = r + Math.abs(aDeg) * 0.25 + lineCrossPenalty;
        if (distScore < bestScore) {
          bestScore = distScore;
          bestCandidate = { tx, ty };
        }
      }
      if (bestCandidate && bestScore < 400) break;
    }

    if (!bestCandidate) {
      bestCandidate = {
        tx: Math.max(MIN_X, Math.min(MAX_X, b.x + 28)),
        ty: Math.max(MIN_Y, Math.min(MAX_Y, b.y - 36 - idx * 38)),
      };
    }

    const anchor = getRectPerimeterAnchor(
      b.x,
      b.y,
      bestCandidate.tx,
      bestCandidate.ty,
      TAG_W,
      TAG_H
    );

    placedTags.push({
      bx: b.x,
      by: b.y,
      tx: bestCandidate.tx,
      ty: bestCandidate.ty,
      anchorX: anchor.x,
      anchorY: anchor.y,
      w: TAG_W,
      h: TAG_H,
    });
  });

  for (let iter = 0; iter < 50; iter++) {
    let moved = false;
    for (let i = 0; i < placedTags.length; i++) {
      for (let j = i + 1; j < placedTags.length; j++) {
        const A = placedTags[i];
        const B = placedTags[j];
        const overlapX = A.w + PAD - Math.abs(A.tx + A.w / 2 - (B.tx + B.w / 2));
        const overlapY = A.h + PAD - Math.abs(A.ty + A.h / 2 - (B.ty + B.h / 2));

        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          if (overlapX < overlapY) {
            const dir = A.tx <= B.tx ? -1 : 1;
            A.tx = Math.max(MIN_X, Math.min(MAX_X, A.tx + (dir * overlapX) / 2));
            B.tx = Math.max(MIN_X, Math.min(MAX_X, B.tx - (dir * overlapX) / 2));
          } else {
            const dir = A.ty <= B.ty ? -1 : 1;
            A.ty = Math.max(MIN_Y, Math.min(MAX_Y, A.ty + (dir * overlapY) / 2));
            B.ty = Math.max(MIN_Y, Math.min(MAX_Y, B.ty - (dir * overlapY) / 2));
          }
        }
      }
    }
    if (!moved) break;
  }

  placedTags.forEach((pt) => {
    const anchor = getRectPerimeterAnchor(pt.bx, pt.by, pt.tx, pt.ty, pt.w, pt.h);
    pt.anchorX = anchor.x;
    pt.anchorY = anchor.y;
    pt.tx = +pt.tx.toFixed(1);
    pt.ty = +pt.ty.toFixed(1);
  });

  return placedTags;
}

function renderRadarChartView(solver) {
  const blipsLayer = document.getElementById("svgBlipsLayer");
  const listEl = document.getElementById("positionSnapshotList");
  const sidebarTimeLabel = document.getElementById("sidebarTimeLabel");
  const slider = document.getElementById("radarTimeSlider");

  if (!blipsLayer || !listEl) return;

  const allItems = [
    ...solver.computedArrivals,
    ...solver.computedDepartures,
    ...solver.computedTransits,
  ];

  if (allItems.length > 0 && slider) {
    const minT = Math.min(
      ...allItems.map((it) => (it.acft.type === "DEP" ? it.normDep : it.normInit))
    );
    const maxT = Math.max(
      ...allItems.map((it) =>
        it.acft.type === "DEP"
          ? it.norm60
          : it.acft.type === "TRN"
          ? it.norm60From || it.normVor + 12
          : solver.eatMap.get(it.acft.id)?.effectiveEstNorm + 2 || it.normInit + 25
      )
    );
    slider.min = Math.floor(minT);
    slider.max = Math.ceil(maxT);
  }

  const parsedQuery = parseTimeInput(state.lookupTimeRaw);
  let queryNorm = parsedQuery.totalMinutes;
  if (solver.refHour !== null && !parsedQuery.hasHour && queryNorm < 120) {
    queryNorm = solver.refHour * 60 + queryNorm;
  }

  if (sidebarTimeLabel) {
    sidebarTimeLabel.textContent = formatTime(
      denormalizeTime(queryNorm, solver.useHasHour, solver.refHour),
      solver.useHasHour
    );
  }

  blipsLayer.innerHTML = "";
  listEl.innerHTML = "";

  if (allItems.length === 0) {
    listEl.innerHTML = `<div class="snapshot-item" style="color:var(--text-muted)">Add aircraft in the Calculator tab to visualize them as live radar blips.</div>`;
    return;
  }

  const visibleBlips = [];

  allItems.forEach((item) => {
    const st = getAircraftStateAtTime(item, solver, queryNorm);
    const wptLabel =
      item.acft.type === "TRN"
        ? `${item.entryWpt.name}→${item.exitWpt.name}`
        : item.wpt.name;

    const badgeClass =
      item.acft.type === "DEP"
        ? "badge-dep"
        : item.acft.type === "TRN"
        ? "badge-trn"
        : item.calc.straightIn
        ? "badge-straight"
        : "badge-normal";

    const row = document.createElement("div");
    row.className = "snapshot-item";
    row.innerHTML = `
      <div class="snapshot-top">
        <span class="callsign-cell">${item.acft.callsign}</span>
        <span class="badge ${badgeClass}">${wptLabel} • ${st.altStr}</span>
      </div>
      <div class="snapshot-status" style="color: ${st.color}">${st.text}</div>
    `;
    listEl.appendChild(row);

    if (st.visible && st.x !== undefined && st.y !== undefined) {
      visibleBlips.push({
        item,
        st,
        x: st.x,
        y: st.y,
      });
    }
  });

  const tagPlacements = computeNonOverlappingTagPositions(visibleBlips);

  visibleBlips.forEach(({ st }, i) => {
    const tag = tagPlacements[i];
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.innerHTML = `
      <line x1="${st.x}" y1="${st.y}" x2="${tag.anchorX}" y2="${tag.anchorY}" stroke="${st.color}" stroke-width="1.5" opacity="0.9" />
      <circle cx="${tag.anchorX}" cy="${tag.anchorY}" r="2.2" fill="${st.color}" />
      <line x1="${st.x}" y1="${st.y}" x2="${st.tipX}" y2="${st.tipY}" stroke="${st.color}" stroke-width="2.2" />
      <rect x="${st.x - 5}" y="${st.y - 5}" width="10" height="10" fill="#0b111e" stroke="${st.color}" stroke-width="2.2" transform="rotate(45 ${st.x} ${st.y})" />
      <circle cx="${st.x}" cy="${st.y}" r="2" fill="${st.color}" />
    `;
    blipsLayer.appendChild(g);
  });

  visibleBlips.forEach(({ item, st }, i) => {
    const tag = tagPlacements[i];
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.innerHTML = `
      <rect x="${tag.tx}" y="${tag.ty}" width="${tag.w}" height="${tag.h}" class="blip-tag-bg" stroke="${st.color}" />
      <text x="${tag.tx + 5}" y="${tag.ty + 12}" class="blip-tag-title" fill="${st.color}">${item.acft.callsign}</text>
      <text x="${tag.tx + 5}" y="${tag.ty + 24}" class="blip-tag-sub">${st.altStr} • ${st.dme}NM</text>
    `;
    blipsLayer.appendChild(g);
  });
}

// ============================================================================
// INITIALIZE APP & EVENT LISTENERS
// ============================================================================
function initApp() {
  loadSavedState();
  renderStaticSvgCorridors();

  // Main View Tabs (Calculator & Conflicts | Chart & Blips)
  const viewTabs = document.querySelectorAll(".view-tab");
  const viewCalc = document.getElementById("viewCalc");
  const viewChart = document.getElementById("viewChart");

  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetView = tab.getAttribute("data-view");
      state.activeView = targetView;
      viewTabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      viewCalc.classList.toggle("hidden", targetView !== "calc");
      viewChart.classList.toggle("hidden", targetView !== "chart");
      renderScenarioBoard();
    });
  });

  const btnRwy36 = document.getElementById("btnRwy36");
  const btnRwy18 = document.getElementById("btnRwy18");

  // One-by-One "New Plane" Prompt Wizard Elements
  const newPlaneLauncher = document.getElementById("newPlaneLauncher");
  const btnOpenNewPlane = document.getElementById("btnOpenNewPlane");
  const newPlaneWizard = document.getElementById("newPlaneWizard");
  const btnCloseWizard = document.getElementById("btnCloseWizard");
  const wizardStepPills = document.getElementById("wizardStepPills");

  const wizStepType = document.getElementById("wizStepType");
  const wizStepCallsign = document.getElementById("wizStepCallsign");
  const wizStepFl = document.getElementById("wizStepFl");
  const wizStepDist = document.getElementById("wizStepDist");
  const wizStepWpt = document.getElementById("wizStepWpt");
  const wizStepTime = document.getElementById("wizStepTime");

  const wizBtnArr = document.getElementById("wizBtnArr");
  const wizBtnDep = document.getElementById("wizBtnDep");
  const wizBtnTrn = document.getElementById("wizBtnTrn");
  const btnResetTransitRoute = document.getElementById("btnResetTransitRoute");

  const wizCallsignLabel = document.getElementById("wizCallsignLabel");
  const wizFlLabel = document.getElementById("wizFlLabel");
  const wizWptLabel = document.getElementById("wizWptLabel");
  const wizTimeLabel = document.getElementById("wizTimeLabel");
  const wizWptActionBtn = document.getElementById("wizWptActionBtn");
  const wizTimeActionBtn = document.getElementById("wizTimeActionBtn");

  const inputCallsign = document.getElementById("inputCallsign");
  const inputFl = document.getElementById("inputFl");
  const inputDist = document.getElementById("inputDist");
  const inputTime = document.getElementById("inputTime");
  const globalQueryDmeInput = document.getElementById("globalQueryDmeInput");

  if (globalQueryDmeInput) {
    globalQueryDmeInput.value = state.globalQueryDme;
    globalQueryDmeInput.addEventListener("input", () => {
      const val = globalQueryDmeInput.value === "" ? 0 : Number(globalQueryDmeInput.value);
      state.globalQueryDme = val;
      state.aircraftList.forEach((a) => {
        a.queryDme = val;
      });
      saveState();
      renderLivePreview();
      renderScenarioBoard();
    });
  }

  document.querySelectorAll(".global-dme-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-dme-step"));
      const cur = Number(globalQueryDmeInput.value) || 0;
      const nextVal = Math.max(0, Math.min(150, cur + step));
      globalQueryDmeInput.value = nextVal;
      state.globalQueryDme = nextVal;
      state.aircraftList.forEach((a) => {
        a.queryDme = nextVal;
      });
      saveState();
      renderLivePreview();
      renderScenarioBoard();
    });
  });

  if (btnResetTransitRoute) {
    btnResetTransitRoute.addEventListener("click", () => {
      state.transitRoute = [];
      renderWaypointGrid();
      renderLivePreview();
    });
  }

  function getStepMetaList() {
    const cs = state.inputCallsign.trim().toUpperCase() || "—";
    if (state.flightType === "DEP") {
      return [
        { key: "TYPE", title: "Type", val: "🛫 DEP" },
        { key: "CALLSIGN", title: "1. Callsign", val: cs },
        { key: "FL", title: "2. FL", val: `FL${state.selectedFl}` },
        { key: "TIME", title: "3. Time", val: state.inputTimeRaw || "00" },
        { key: "WPT", title: "4. WPT", val: state.selectedWpt },
      ];
    }
    if (state.flightType === "TRN") {
      const routeShort =
        state.transitRoute.length > 0 ? state.transitRoute.join("→") : "Select Route";
      return [
        { key: "TYPE", title: "Type", val: "✈️ TRN" },
        { key: "CALLSIGN", title: "1. Callsign", val: cs },
        { key: "FL", title: "2. Maint FL", val: `FL${state.selectedFl}` },
        { key: "DIST", title: "3. Dist", val: `${state.selectedDist} NM` },
        { key: "WPT", title: "4. Route", val: routeShort },
        { key: "TIME", title: "5. Report Time", val: state.inputTimeRaw || "00" },
      ];
    }
    return [
      { key: "TYPE", title: "Type", val: "🛬 ARR" },
      { key: "CALLSIGN", title: "1. Callsign", val: cs },
      { key: "FL", title: "2. FL", val: `FL${state.selectedFl}` },
      { key: "DIST", title: "3. Dist", val: `${state.selectedDist} NM` },
      { key: "WPT", title: "4. Waypoint", val: state.selectedWpt },
      { key: "TIME", title: "5. Report Time", val: state.inputTimeRaw || "00" },
    ];
  }

  function submitWizardAircraft() {
    const isDep = state.flightType === "DEP";
    const isTrn = state.flightType === "TRN";
    const defaultPrefix = isDep ? "DEP" : isTrn ? "TRN" : "ACFT";
    const callsign =
      state.inputCallsign.trim().toUpperCase() || `${defaultPrefix} ${state.nextId}`;

    if (isTrn) {
      const endpoints = normalizeTransitEndpoints({ route: state.transitRoute });
      state.aircraftList.push({
        id: state.nextId++,
        type: "TRN",
        callsign,
        wptId: endpoints.entryWptId,
        entryWptId: endpoints.entryWptId,
        exitWptId: endpoints.exitWptId,
        route: [endpoints.entryWptId, "AYT", endpoints.exitWptId],
        fl: Number(inputFl.value) || state.selectedFl || 150,
        dist: Number(inputDist.value) || 60,
        timeRaw: inputTime.value.trim() || "00",
        queryDme: state.globalQueryDme,
        holdMins: 0,
      });
    } else {
      state.aircraftList.push({
        id: state.nextId++,
        type: state.flightType,
        callsign,
        wptId: state.selectedWpt,
        fl: Number(inputFl.value) || state.selectedFl || 250,
        dist: isDep ? 0 : Number(inputDist.value) || 60,
        timeRaw: inputTime.value.trim() || "00",
        mode: "auto",
        queryDme: state.globalQueryDme,
        holdMins: 0,
      });
    }

    state.inputCallsign = "";
    inputCallsign.value = "";
    state.wizardOpen = false;
    state.wizardStepIdx = 0;

    saveState();
    syncWizardUI(false);
    renderScenarioBoard();
  }

  function syncWizardUI(autoFocus = true) {
    newPlaneLauncher.classList.toggle("hidden", state.wizardOpen);
    newPlaneWizard.classList.toggle("hidden", !state.wizardOpen);

    if (!state.wizardOpen) return;

    const isDep = state.flightType === "DEP";
    const isTrn = state.flightType === "TRN";
    const steps = getWizardStepOrder(state.flightType);
    if (state.wizardStepIdx < 0) state.wizardStepIdx = 0;
    if (state.wizardStepIdx >= steps.length) state.wizardStepIdx = steps.length - 1;

    const currentKey = steps[state.wizardStepIdx];
    const metaList = getStepMetaList();

    wizardStepPills.innerHTML = "";
    metaList.forEach((m, idx) => {
      const pill = document.createElement("button");
      pill.type = "button";
      const isDone = idx < state.wizardStepIdx;
      const isActive = idx === state.wizardStepIdx;
      pill.className = `wiz-pill ${isDone ? "done" : ""} ${isActive ? "active" : ""}`;
      pill.innerHTML =
        idx === 0 && state.wizardStepIdx === 0
          ? `<span>ARR / DEP / TRN</span>`
          : isDone || isActive
          ? `<span>${m.title}:</span> <strong>${m.val}</strong>`
          : `<span>${m.title}</span>`;
      pill.addEventListener("click", () => {
        state.wizardStepIdx = idx;
        syncWizardUI(true);
      });
      wizardStepPills.appendChild(pill);
    });

    wizStepType.classList.toggle("hidden", currentKey !== "TYPE");
    wizStepCallsign.classList.toggle("hidden", currentKey !== "CALLSIGN");
    wizStepFl.classList.toggle("hidden", currentKey !== "FL");
    wizStepDist.classList.toggle("hidden", currentKey !== "DIST");
    wizStepWpt.classList.toggle("hidden", currentKey !== "WPT");
    wizStepTime.classList.toggle("hidden", currentKey !== "TIME");

    wizCallsignLabel.textContent = isDep
      ? "Step 1 of 4 (Departure) — Enter Aircraft Callsign"
      : isTrn
      ? "Step 1 of 5 (Transit) — Enter Aircraft Callsign"
      : "Step 1 of 5 (Arrival) — Enter Aircraft Callsign";

    wizFlLabel.textContent = isDep
      ? "Step 2 of 4 (Departure) — Enter Requested Flight Level (FL)"
      : isTrn
      ? "Step 2 of 5 (Transit) — Enter Maintained Flight Level (FL)"
      : "Step 2 of 5 (Arrival) — Enter Initial Flight Level (FL)";

    wizWptLabel.textContent = isDep
      ? "Step 4 of 4 (Departure) — Select Departure Waypoint (WPT)"
      : isTrn
      ? "Step 4 of 5 (Transit) — Select Route (All Waypoints + AYT VOR)"
      : "Step 4 of 5 (Arrival) — Select Entry Waypoint (Auto Normal / Straight-In)";

    wizTimeLabel.innerHTML = isDep
      ? `Step 3 of 4 (Departure) — Enter Departure Time at 0 NM <span class="hint">(e.g. <code>02</code> or <code>10:02</code>)</span>`
      : isTrn
      ? `Step 5 of 5 (Transit) — Enter Entry Report Time at ${state.selectedDist} NM <span class="hint">(e.g. <code>03</code> or <code>10:03</code>)</span>`
      : `Step 5 of 5 (Arrival) — Enter Report Time at ${state.selectedDist} NM <span class="hint">(e.g. <code>01</code>, <code>05</code>, or <code>10:05</code>)</span>`;

    if (isDep) {
      wizWptActionBtn.className = "primary-btn dep-mode";
      wizWptActionBtn.innerHTML = `<span>✅ Add Departure to Scenario (Enter)</span>`;
    } else {
      wizWptActionBtn.className = "primary-btn";
      wizWptActionBtn.innerHTML = `<span>Next: Report Time → (Enter)</span>`;
    }

    if (isDep) {
      wizTimeActionBtn.className = "primary-btn";
      wizTimeActionBtn.innerHTML = `<span>Next: Waypoint → (Enter)</span>`;
    } else if (isTrn) {
      wizTimeActionBtn.className = "primary-btn trn-mode";
      wizTimeActionBtn.innerHTML = `<span>✅ Add Transit to Scenario (Enter)</span>`;
    } else {
      wizTimeActionBtn.className = "primary-btn";
      wizTimeActionBtn.innerHTML = `<span>✅ Add Arrival to Scenario (Enter)</span>`;
    }

    renderWaypointGrid();
    renderLivePreview();

    if (autoFocus) {
      setTimeout(() => {
        if (currentKey === "CALLSIGN") {
          inputCallsign.focus();
          inputCallsign.select();
        } else if (currentKey === "FL") {
          inputFl.focus();
          inputFl.select();
        } else if (currentKey === "DIST") {
          inputDist.focus();
          inputDist.select();
        } else if (currentKey === "TIME") {
          inputTime.focus();
          inputTime.select();
        }
      }, 20);
    }
  }

  window.syncWizardUI = syncWizardUI;

  function advanceWizardStep() {
    const steps = getWizardStepOrder(state.flightType);
    if (state.wizardStepIdx < steps.length - 1) {
      state.wizardStepIdx++;
      syncWizardUI(true);
    } else {
      submitWizardAircraft();
    }
  }

  function prevWizardStep() {
    if (state.wizardStepIdx > 0) {
      state.wizardStepIdx--;
      syncWizardUI(true);
    } else {
      state.wizardOpen = false;
      syncWizardUI(false);
    }
  }

  btnOpenNewPlane.addEventListener("click", () => {
    state.wizardOpen = true;
    state.wizardStepIdx = 0;
    state.inputCallsign = "";
    inputCallsign.value = "";
    state.selectedDist = 60;
    inputDist.value = 60;
    syncWizardUI(true);
  });

  btnCloseWizard.addEventListener("click", () => {
    state.wizardOpen = false;
    syncWizardUI(false);
  });

  wizBtnArr.addEventListener("click", () => {
    state.flightType = "ARR";
    state.selectedDist = 60;
    inputDist.value = 60;
    state.wizardStepIdx = 1;
    syncWizardUI(true);
  });

  wizBtnDep.addEventListener("click", () => {
    state.flightType = "DEP";
    state.wizardStepIdx = 1;
    syncWizardUI(true);
  });

  if (wizBtnTrn) {
    wizBtnTrn.addEventListener("click", () => {
      state.flightType = "TRN";
      state.selectedDist = 60;
      inputDist.value = 60;
      state.selectedFl = 150;
      inputFl.value = 150;
      if (!state.transitRoute || state.transitRoute.length === 0) {
        state.transitRoute = ["KUMRU", "AYT", "DERYA"];
      }
      state.wizardStepIdx = 1;
      syncWizardUI(true);
    });
  }

  document.querySelectorAll(".wiz-back-btn").forEach((btn) => {
    btn.addEventListener("click", prevWizardStep);
  });

  document.querySelectorAll(".wiz-next-btn").forEach((btn) => {
    btn.addEventListener("click", advanceWizardStep);
  });

  wizWptActionBtn.addEventListener("click", () => {
    if (state.flightType === "DEP") {
      submitWizardAircraft();
    } else {
      advanceWizardStep();
    }
  });

  wizTimeActionBtn.addEventListener("click", () => {
    if (state.flightType === "ARR" || state.flightType === "TRN") {
      submitWizardAircraft();
    } else {
      advanceWizardStep();
    }
  });

  [inputCallsign, inputFl, inputDist, inputTime].forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        advanceWizardStep();
      }
    });
  });

  function updateRwyUI() {
    btnRwy36.classList.toggle("active", state.activeRwy === "36");
    btnRwy18.classList.toggle("active", state.activeRwy === "18");
    renderWaypointGrid();
    renderLivePreview();
    renderScenarioBoard();
  }

  btnRwy36.addEventListener("click", () => {
    state.activeRwy = "36";
    saveState();
    updateRwyUI();
  });

  btnRwy18.addEventListener("click", () => {
    state.activeRwy = "18";
    saveState();
    updateRwyUI();
  });

  inputFl.addEventListener("input", () => {
    state.selectedFl = Number(inputFl.value) || 100;
    syncWizardUI(false);
  });

  document.querySelectorAll(".fl-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-fl-step"));
      const cur = Number(inputFl.value) || 250;
      const nextFl = Math.max(30, Math.min(450, cur + step));
      inputFl.value = nextFl;
      state.selectedFl = nextFl;
      syncWizardUI(false);
    });
  });

  document.querySelectorAll(".fl-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = Number(btn.getAttribute("data-fl-val"));
      inputFl.value = val;
      state.selectedFl = val;
      advanceWizardStep();
    });
  });

  inputDist.addEventListener("input", () => {
    state.selectedDist = Number(inputDist.value) || 0;
    syncWizardUI(false);
  });

  document.querySelectorAll(".dist-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-dist-step"));
      const cur = Number(inputDist.value) || 60;
      const nextDist = Math.max(5, cur + step);
      inputDist.value = nextDist;
      state.selectedDist = nextDist;
      syncWizardUI(false);
    });
  });

  document.querySelectorAll(".dist-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = Number(btn.getAttribute("data-dist-val"));
      inputDist.value = val;
      state.selectedDist = val;
      advanceWizardStep();
    });
  });

  inputTime.addEventListener("input", () => {
    state.inputTimeRaw = inputTime.value;
    syncWizardUI(false);
  });

  document.querySelectorAll(".minute-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-step"));
      const parsed = parseTimeInput(inputTime.value);
      const nextMins = Math.max(0, parsed.totalMinutes + step);
      if (parsed.hasHour) {
        inputTime.value = formatTime(nextMins, true);
      } else {
        inputTime.value = String(Math.round(nextMins)).padStart(2, "0");
      }
      state.inputTimeRaw = inputTime.value;
      syncWizardUI(false);
    });
  });

  inputCallsign.addEventListener("input", () => {
    state.inputCallsign = inputCallsign.value;
    syncWizardUI(false);
  });

  document.getElementById("btnSortByEst").addEventListener("click", () => {
    const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
    state.aircraftList.sort((a, b) => {
      if (a.type !== b.type) {
        const order = { ARR: 0, DEP: 1, TRN: 2 };
        return (order[a.type] ?? 0) - (order[b.type] ?? 0);
      }
      if (a.type === "ARR") {
        const ea = solver.eatMap.get(a.id)?.effectiveEstNorm || 0;
        const eb = solver.eatMap.get(b.id)?.effectiveEstNorm || 0;
        return ea - eb;
      }
      return a.id - b.id;
    });
    saveState();
    renderScenarioBoard();
  });

  document.getElementById("btnSortByInit").addEventListener("click", () => {
    const refHour = getReferenceBaseHour(state.aircraftList);
    state.aircraftList.sort((a, b) => {
      const ta = parseTimeInput(a.timeRaw);
      const tb = parseTimeInput(b.timeRaw);
      return (
        normalizeTime(ta.totalMinutes, ta.hasHour, refHour) -
        normalizeTime(tb.totalMinutes, tb.hasHour, refHour)
      );
    });
    saveState();
    renderScenarioBoard();
  });

  document.getElementById("btnClearAll").addEventListener("click", () => {
    state.aircraftList = [];
    state.nextId = 1;
    saveState();
    renderScenarioBoard();
  });

  // Radar Chart Time Lookup, Slider & Play Animation
  const lookupTimeInput = document.getElementById("lookupTimeInput");
  const radarTimeSlider = document.getElementById("radarTimeSlider");
  const btnPlayRadar = document.getElementById("btnPlayRadar");

  function setRadarTimeFromMinutes(normMins) {
    const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
    const disp = denormalizeTime(normMins, solver.useHasHour, solver.refHour);
    if (solver.useHasHour) {
      lookupTimeInput.value = formatTime(disp, true);
    } else {
      lookupTimeInput.value = String(Math.round(disp)).padStart(2, "0");
    }
    state.lookupTimeRaw = lookupTimeInput.value;
    if (radarTimeSlider) radarTimeSlider.value = normMins;
    renderRadarChartView(solver);
  }

  lookupTimeInput.addEventListener("input", () => {
    state.lookupTimeRaw = lookupTimeInput.value;
    const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
    const p = parseTimeInput(state.lookupTimeRaw);
    const norm = normalizeTime(p.totalMinutes, p.hasHour, solver.refHour);
    if (radarTimeSlider) radarTimeSlider.value = norm;
    renderRadarChartView(solver);
  });

  if (radarTimeSlider) {
    radarTimeSlider.addEventListener("input", () => {
      setRadarTimeFromMinutes(parseFloat(radarTimeSlider.value));
    });
  }

  document.querySelectorAll(".lookup-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-step"));
      const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      const parsed = parseTimeInput(lookupTimeInput.value);
      const norm = normalizeTime(parsed.totalMinutes, parsed.hasHour, solver.refHour);
      setRadarTimeFromMinutes(Math.max(0, norm + step));
    });
  });

  if (btnPlayRadar) {
    btnPlayRadar.addEventListener("click", () => {
      if (state.playInterval) {
        clearInterval(state.playInterval);
        state.playInterval = null;
        btnPlayRadar.textContent = "▶ Play";
        return;
      }
      btnPlayRadar.textContent = "⏸ Pause";
      state.playInterval = setInterval(() => {
        const cur = parseFloat(radarTimeSlider.value) || 0;
        const max = parseFloat(radarTimeSlider.max) || 40;
        if (cur >= max) {
          setRadarTimeFromMinutes(parseFloat(radarTimeSlider.min) || 0);
        } else {
          setRadarTimeFromMinutes(+(cur + 0.25).toFixed(2));
        }
      }, 220);
    });
  }

  syncWizardUI(false);
  updateRwyUI();
}

document.addEventListener("DOMContentLoaded", initApp);
