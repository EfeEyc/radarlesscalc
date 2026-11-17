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

// ============================================================================
// SCENARIO JSON IMPORTER, OUTER-FIX MAPPER & GEMINI SKILL PROMPT
// Maps both TMA Waypoints AND Whiteboard Outer Fixes (TOMBİ, KFK, HİSAR, etc.)
// ============================================================================
const FIX_TO_WAYPOINT_MAP = {
  DERYA: "DERYA",
  TOMBI: "DERYA",
  TOMBİ: "DERYA",
  "VA-16S": "DERYA",

  KUMRU: "KUMRU",
  KFK: "KUMRU",
  AFYON: "KUMRU",

  BRONZ: "BRONZ",
  CRD: "BRONZ",
  CARDAK: "BRONZ",
  ÇARDAK: "BRONZ",

  ALPAY: "ALPAY",
  "W-79": "ALPAY",
  W79: "ALPAY",

  DAMLA: "DAMLA",
  HISAR: "DAMLA",
  HİSAR: "DAMLA",
  "W-77": "DAMLA",
  W77: "DAMLA",

  KONAK: "KONAK",
  MUT: "KONAK",

  MANAV: "MANAV",
  DOREN: "MANAV",
  "W-83": "MANAV",
  W83: "MANAV",

  AYT: "AYT",
  "AYT VOR": "AYT",
  VOR: "AYT",
};

function resolveWaypointCode(raw) {
  if (!raw) return "DERYA";
  const cleaned = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (FIX_TO_WAYPOINT_MAP[cleaned]) return FIX_TO_WAYPOINT_MAP[cleaned];

  // ascii fallback for Turkish İ / I / Ç / Ş
  const ascii = cleaned
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/Ç/g, "C")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O");
  if (FIX_TO_WAYPOINT_MAP[ascii]) return FIX_TO_WAYPOINT_MAP[ascii];

  for (const [key, val] of Object.entries(FIX_TO_WAYPOINT_MAP)) {
    if (ascii.includes(key)) return val;
  }
  return "DERYA";
}

function normalizeImportedFl(rawFl, fallbackFl = 250) {
  if (rawFl === undefined || rawFl === null || rawFl === "") return fallbackFl;
  const cleaned = String(rawFl)
    .toUpperCase()
    .replace(/FL/g, "")
    .replace(/FT|'|,/g, "")
    .trim();
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) || num <= 0) return fallbackFl;
  if (num >= 1000) return Math.round(num / 100);
  return Math.round(num);
}

function normalizeImportedType(rawType) {
  const s = String(rawType || "ARR")
    .trim()
    .toUpperCase();
  if (s === "DEP" || s === "DEPARTURE" || s === "OUTBOUND" || s === "↑" || s === "UP") {
    return "DEP";
  }
  if (
    s === "TRN" ||
    s === "TRANSIT" ||
    s === "OVERFLIGHT" ||
    s === "U" ||
    s === "∪" ||
    s === "∩"
  ) {
    return "TRN";
  }
  return "ARR";
}

// Exact PR.6 RADARSIZ APP. 2026 Whiteboard Example from photo
const PR6_BOARD_EXAMPLE = {
  scenario: "PR.6 RADARSIZ APP. 2026",
  rwy: "36",
  aircraft: [
    {
      type: "ARR",
      callsign: "BAW8VZ",
      acftType: "A380",
      fl: 260,
      time: "10:07",
      wpt: "KFK",
      dist: 50,
    },
    {
      type: "DEP",
      callsign: "MSR5ZV",
      acftType: "B747",
      fl: 270,
      time: "10:03",
      wpt: "TOMBİ",
    },
    {
      type: "ARR",
      callsign: "SXS8RV",
      acftType: "B738",
      fl: 250,
      time: "10:06",
      wpt: "HİSAR",
      dist: 55,
    },
    {
      type: "DEP",
      callsign: "PGT9TW",
      acftType: "A321",
      fl: 330,
      time: "10:04",
      wpt: "HİSAR",
    },
    {
      type: "ARR",
      callsign: "JAV5W9",
      acftType: "A380",
      fl: 250,
      time: "10:02",
      wpt: "TOMBİ",
      dist: 60,
    },
    {
      type: "DEP",
      callsign: "KLM8VR",
      acftType: "B747",
      fl: 360,
      time: "10:05",
      wpt: "KFK",
    },
    {
      type: "TRN",
      callsign: "TCLAB",
      acftType: "LR55",
      fl: 140,
      time: "10:01",
      route: ["TOMBİ", "AYT", "KFK"],
      dist: 60,
    },
    {
      type: "TRN",
      callsign: "TCKLA",
      acftType: "LR35",
      fl: 150,
      time: "10:08",
      route: ["ALPAY", "AYT", "HİSAR"],
      dist: 50,
    },
  ],
};

const GEMINI_SKILL_PROMPT = `You are an ATC Whiteboard OCR & Scenario JSON Generator for the AYT TMA Radarless Approach Calculator (https://efeeyc.github.io/radarlesscalc/).

Whenever the user sends a photo of an ATC classroom whiteboard (or text of a traffic list), extract every aircraft row and output ONLY a valid JSON code block matching the schema below.

### 1. How to Read Each Whiteboard Row
Each row starts with a symbol on the left indicating the flight type:

1. **↓ (Down Arrow) = ARRIVAL ("ARR")**
   - Typical board format: \`↓ CALLSIGN - ACFT_TYPE - FL - TIME - ENTRY_FIX - AYT - DIST NM\`
   - Example: \`↓ BAW8VZ - A380 - FL260 - 10:07 - KFK - AYT - 50 NM\`
   - If a Flight Level is crossed out and replaced (e.g. \`290\` crossed out with \`260\` written below/next to it), ALWAYS use the corrected number (\`260\`).
   - Output fields: \`type: "ARR"\`, \`callsign\`, \`fl\` (integer FL, e.g. 260), \`time\` (e.g. "10:07"), \`wpt\` (mapped TMA waypoint or fix name), \`dist\` (integer NM, e.g. 50).

2. **↑ (Up Arrow) = DEPARTURE ("DEP")**
   - Typical board format: \`↑ CALLSIGN - ACFT_TYPE - 5000' - TIME - AYT (FLxxx) - EXIT_FIX\`
   - Example: \`↑ MSR5ZV - B747 - 5000 - 10:03 - AYT (FL270) - TOMBI\`
   - IMPORTANT: Ignore the initial \`5000\` or \`5000'\` climb altitude! Use the requested cruise Flight Level inside parentheses after AYT, e.g. \`(FL270)\` -> \`fl: 270\`.
   - Output fields: \`type: "DEP"\`, \`callsign\`, \`fl\` (requested FL from parentheses, e.g. 270), \`time\` (departure time, e.g. "10:03"), \`wpt\` (exit waypoint/fix).

3. **∪ or U (U-shaped curve) = TRANSIT ("TRN")**
   - Typical board format: \`∪ CALLSIGN - ACFT_TYPE - FL - TIME - ENTRY_FIX - AYT - EXIT_FIX - DIST NM\`
   - Example: \`∪ TCLAB - LR55 - FL140 - 10:01 - TOMBI - AYT - KFK - 60 NM\`
   - Output fields: \`type: "TRN"\`, \`callsign\`, \`fl\` (maintained FL, e.g. 140), \`time\` (entry report time, e.g. "10:01"), \`route: ["ENTRY_WPT", "AYT", "EXIT_WPT"]\`, \`dist\` (entry distance in NM, e.g. 60).

### 2. Outer Fix to AYT TMA Waypoint Mapping
Convert outer fixes to canonical TMA Waypoints (or keep them, the calculator accepts both):
- \`TOMBİ\` / \`TOMBI\` -> \`"DERYA"\`
- \`KFK\` -> \`"KUMRU"\`
- \`CRD\` -> \`"BRONZ"\`
- \`W-79\` / \`ALPAY\` -> \`"ALPAY"\`
- \`HİSAR\` / \`HISAR\` -> \`"DAMLA"\`
- \`MUT\` -> \`"KONAK"\`
- \`DOREN\` -> \`"MANAV"\`
- \`AYT\` -> \`"AYT"\`

### 3. Output Format
Return ONLY a single \`\`\`json code block (no extra commentary) in this exact structure:
\`\`\`json
{
  "scenario": "PR.6 RADARSIZ APP. 2026",
  "rwy": "36",
  "aircraft": [
    { "type": "ARR", "callsign": "BAW8VZ", "fl": 260, "time": "10:07", "wpt": "KUMRU", "dist": 50 },
    { "type": "DEP", "callsign": "MSR5ZV", "fl": 270, "time": "10:03", "wpt": "DERYA" },
    { "type": "TRN", "callsign": "TCLAB", "fl": 140, "time": "10:01", "route": ["DERYA", "AYT", "KUMRU"], "dist": 60 }
  ]
}
\`\`\``;

function parseScenarioJsonText(rawText) {
  if (!rawText || !String(rawText).trim()) {
    throw new Error("JSON input is empty. Paste the JSON from your Gemini skill first.");
  }

  // Strip ```json ... ``` markdown fences if present
  let cleaned = String(rawText).trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Invalid JSON syntax: ${e.message}`);
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.aircraft)
    ? parsed.aircraft
    : Array.isArray(parsed.planes)
    ? parsed.planes
    : Array.isArray(parsed.traffic)
    ? parsed.traffic
    : null;

  if (!list || list.length === 0) {
    throw new Error(
      'JSON must be an array of aircraft or an object containing an "aircraft": [...] array.'
    );
  }

  const rwy =
    parsed && (String(parsed.rwy) === "18" || String(parsed.runway) === "18")
      ? "18"
      : parsed && (String(parsed.rwy) === "36" || String(parsed.runway) === "36")
      ? "36"
      : null;

  const normalizedAircraft = list.map((item, idx) => {
    const type = normalizeImportedType(item.type || item.flightType || item.kind);
    const callsign = String(item.callsign || item.cs || item.id || `ACFT${idx + 1}`)
      .trim()
      .toUpperCase();
    const timeRaw = String(item.time ?? item.timeRaw ?? item.reportTime ?? "00").trim();

    if (type === "TRN") {
      let rawRoute = [];
      if (Array.isArray(item.route) && item.route.length > 0) {
        rawRoute = item.route;
      } else if (typeof item.route === "string" && item.route.trim()) {
        rawRoute = item.route.split(/\s*[-→>,/]+\s*/);
      } else {
        rawRoute = [
          item.entryWpt || item.from || item.wpt || "DERYA",
          "AYT",
          item.exitWpt || item.to || "KUMRU",
        ];
      }

      const mappedRoute = rawRoute.map((r) => resolveWaypointCode(r));
      const entryWptId = mappedRoute[0] || "DERYA";
      const exitWptId =
        mappedRoute.length > 1 ? mappedRoute[mappedRoute.length - 1] : "KUMRU";

      return {
        type: "TRN",
        callsign,
        wptId: entryWptId,
        entryWptId,
        exitWptId,
        route: [entryWptId, "AYT", exitWptId],
        fl: normalizeImportedFl(item.fl ?? item.flightLevel, 150),
        dist: Number(item.dist ?? item.distance ?? 60) || 60,
        timeRaw,
        holdMins: Number(item.holdMins) || 0,
      };
    }

    const wptId = resolveWaypointCode(
      item.wpt || item.waypoint || item.wptId || item.fix || item.exitWpt || item.entryWpt
    );

    if (type === "DEP") {
      return {
        type: "DEP",
        callsign,
        wptId,
        fl: normalizeImportedFl(item.fl ?? item.flightLevel ?? item.reqFl, 270),
        dist: 0,
        timeRaw,
        mode: "auto",
        holdMins: 0,
      };
    }

    return {
      type: "ARR",
      callsign,
      wptId,
      fl: normalizeImportedFl(item.fl ?? item.flightLevel, 250),
      dist: Number(item.dist ?? item.distance ?? 60) || 60,
      timeRaw,
      mode: "auto",
      holdMins: Number(item.holdMins) || 0,
    };
  });

  return {
    rwy,
    scenarioName: parsed.scenario || parsed.name || null,
    aircraft: normalizedAircraft,
  };
}

// Application State
const VERT_RATE_FPM = 2500; // Realistic radarless vertical transition rate (25 FL / min)

const state = {
  activeView: "calc", // 'calc' | 'chart'
  chartMode: "3d", // '3d' | '2d'
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
  selectedTestAcftId: null,
  conflictScope: "all", // 'all' | 'now'
  cam: {
    yawDeg: 28,
    pitchDeg: 34,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    altScale: 1.0,
  },
  projectedBlips3d: [], // Hitboxes from last 3D render
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
      localStorage.getItem("ayt_radarsiz_state_v5") ||
      localStorage.getItem("ayt_radarsiz_state_v4") ||
      localStorage.getItem("ayt_radarsiz_state_v3") ||
      localStorage.getItem("ayt_radarsiz_state_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.activeRwy) state.activeRwy = parsed.activeRwy;
      if (typeof parsed.globalQueryDme === "number") {
        state.globalQueryDme = parsed.globalQueryDme;
      }
      if (parsed.cam && typeof parsed.cam === "object") {
        state.cam = { ...state.cam, ...parsed.cam };
      }
      if (Array.isArray(parsed.aircraftList)) {
        state.aircraftList = parsed.aircraftList.map((a) => {
          const wpt = getWaypointOrVor(a.wptId || a.entryWptId);
          const type = a.type || "ARR";
          const endpoints =
            type === "TRN" ? normalizeTransitEndpoints(a) : { entryWptId: a.wptId, exitWptId: null };
          const baseFl = a.fl || (type === "DEP" ? wpt.defaultDepFl : wpt.defaultArrFl);
          return {
            ...a,
            type,
            wptId: a.wptId || endpoints.entryWptId || "DERYA",
            entryWptId: endpoints.entryWptId,
            exitWptId: endpoints.exitWptId,
            fl: baseFl,
            flMode: a.flMode === "test" ? "test" : "auto",
            testFl: typeof a.testFl === "number" ? a.testFl : baseFl,
            stepTimeRaw: typeof a.stepTimeRaw === "string" ? a.stepTimeRaw : "",
            stepFl: typeof a.stepFl === "number" ? a.stepFl : null,
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
      "ayt_radarsiz_state_v5",
      JSON.stringify({
        activeRwy: state.activeRwy,
        globalQueryDme: state.globalQueryDme,
        cam: state.cam,
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

// Parse flexible time input: "0", "5", "05", ":05", ":07:30", "10:05", "10:07:30", "1005"
function parseTimeInput(rawStr) {
  const s = String(rawStr ?? "").trim();
  if (!s) {
    return { valid: true, hasHour: false, totalMinutes: 0 };
  }

  if (s.startsWith(":")) {
    const rest = s.slice(1);
    const colonIdx = rest.indexOf(":");
    if (colonIdx !== -1) {
      const m = parseInt(rest.slice(0, colonIdx), 10);
      const sec = parseFloat(rest.slice(colonIdx + 1)) || 0;
      if (!Number.isNaN(m)) {
        return { valid: true, hasHour: false, totalMinutes: m + sec / 60 };
      }
    }
    const m = parseFloat(rest);
    if (!Number.isNaN(m)) {
      return { valid: true, hasHour: false, totalMinutes: m };
    }
  }

  if (s.includes(":")) {
    const parts = s.split(":");
    const hh = parseInt(parts[0], 10);
    const mm = parseFloat(parts[1]);
    const ss = parts[2] !== undefined ? parseFloat(parts[2]) || 0 : 0;
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      return {
        valid: true,
        hasHour: true,
        totalMinutes: hh * 60 + mm + ss / 60,
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
  // 2. Build Base Solver Context & Run Live 4D Conflict Scanner
  // --------------------------------------------------------------------------
  const baseSolver = {
    refHour,
    useHasHour,
    computedArrivals,
    computedDepartures,
    computedTransits,
    sequencedArrivals,
    eatMap,
  };

  const scanResult = detect4DConflicts(baseSolver);

  return {
    ...baseSolver,
    tMin: scanResult.tMin,
    tMax: scanResult.tMax,
    headOnConflicts: scanResult.headOnConflicts,
    radialConflicts: scanResult.radialConflicts,
    conflicts4d: scanResult.conflicts4d,
    heatmapBins: scanResult.heatmapBins,
    conflictAcftIds: scanResult.conflictAcftIds,
  };
}

// ============================================================================
// 4D TRAJECTORY ENGINE & REAL-TIME SEPARATION CONFLICT DETECTOR
// Implements:
//  1. VOR Separation: BOTH aircraft must be >= 15 DME when crossing/sharing alt
//     (Rule exempts DEP <-> DEP pairs only; applies to all other pairs!)
//  2. Head-to-Head Routes: Tracks within <45° of reciprocal (180° ± 45°)
//     while closing are NOT allowed to cross/share altitudes within 100 NM!
//  3. Same-Radial Proximity: Non-(DEP<->DEP) aircraft on same radial (<15°)
//     within <15 NM horizontally without 1,000 ft vertical separation.
// ============================================================================
function polarToNm(dmeNm, deg) {
  const rad = (deg * Math.PI) / 180;
  return {
    xNm: dmeNm * Math.sin(rad),
    yNm: dmeNm * Math.cos(rad),
  };
}

function polarToSvg(dmeNm, deg) {
  const { xNm, yNm } = polarToNm(dmeNm, deg);
  return {
    x: +(SVG_CENTER_X + xNm * PX_PER_NM).toFixed(1),
    y: +(SVG_CENTER_Y - yNm * PX_PER_NM).toFixed(1),
  };
}

function nmToSvg(xNm, yNm) {
  return {
    x: +(SVG_CENTER_X + xNm * PX_PER_NM).toFixed(1),
    y: +(SVG_CENTER_Y - yNm * PX_PER_NM).toFixed(1),
  };
}

function stepTowardAlt(startAlt, targetAlt, dtMins, rateFpm = VERT_RATE_FPM) {
  const delta = Math.max(0, dtMins) * rateFpm;
  if (targetAlt >= startAlt) return Math.min(targetAlt, startAlt + delta);
  return Math.max(targetAlt, startAlt - delta);
}

function evalPiecewiseAlt(anchors, tQuery) {
  if (!anchors || anchors.length === 0) return 10000;
  if (tQuery <= anchors[0].t) return anchors[0].alt;
  const last = anchors[anchors.length - 1];
  if (tQuery >= last.t) return last.alt;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (tQuery >= a.t && tQuery <= b.t) {
      const span = b.t - a.t;
      if (span <= 1e-6) return b.alt;
      const frac = (tQuery - a.t) / span;
      return a.alt + (b.alt - a.alt) * frac;
    }
  }
  return last.alt;
}

function evaluatePlannedAltitude(item, eatInfo, queryNormMins, refHour) {
  const { acft, calc } = item;
  const isTest = acft.flMode === "test";
  const target1Ft = isTest
    ? flInputToFeet(acft.testFl ?? acft.fl)
    : null;

  function evalBasePhase1(t) {
    // TRANSIT
    if (acft.type === "TRN") {
      return isTest ? target1Ft : calc.maintAltFt;
    }

    // DEPARTURE
    if (acft.type === "DEP") {
      const { wpt } = item;
      const tDep = item.normDep;
      if (t <= tDep) return 1000;

      const finalTargetFt = isTest ? target1Ft : calc.reqAltFt;
      const msaCap = isTest ? Math.min(finalTargetFt, wpt.msaFt) : Math.min(calc.reqAltFt, wpt.msaFt);
      const meaCap = isTest
        ? Math.min(finalTargetFt, Math.max(wpt.msaFt, wpt.meaFt))
        : Math.min(calc.reqAltFt, Math.max(wpt.msaFt, wpt.meaFt));

      if (t <= item.norm10) {
        return evalPiecewiseAlt(
          [
            { t: tDep, alt: 1000 },
            { t: item.norm10, alt: msaCap },
          ],
          t
        );
      }
      if (t <= item.norm25) {
        return evalPiecewiseAlt(
          [
            { t: item.norm10, alt: msaCap },
            { t: item.norm25, alt: meaCap },
          ],
          t
        );
      }
      return stepTowardAlt(meaCap, finalTargetFt, t - item.norm25, VERT_RATE_FPM);
    }

    // ARRIVAL
    const { wpt } = item;
    if (isTest) {
      if (t <= item.normInit) return calc.initAltFt;
      return stepTowardAlt(calc.initAltFt, target1Ft, t - item.normInit, VERT_RATE_FPM);
    }

    const t25 = item.norm25 ?? item.normInit;
    const alt25 = Math.min(calc.initAltFt, wpt.meaFt);

    if (calc.straightIn) {
      const inner10Alt = eatInfo && eatInfo.willDelay ? Math.max(4000, wpt.msaFt) : 3000;
      const estNorm = eatInfo ? eatInfo.effectiveEstNorm : item.norm10;
      const anchors = [
        { t: item.normInit, alt: calc.initAltFt },
        { t: t25, alt: alt25 },
        { t: item.norm10, alt: inner10Alt },
      ];
      if (estNorm > item.norm10 + 0.05) {
        anchors.push({ t: estNorm - 0.1, alt: 4000 });
        anchors.push({ t: estNorm, alt: 3000 });
      }
      anchors.push({ t: estNorm + 2, alt: 0 });
      return evalPiecewiseAlt(anchors, t);
    }

    const inner10Alt = Math.max(wpt.msaFt, 4000);
    const estNorm = eatInfo ? eatInfo.effectiveEstNorm : item.norm10 + 9;
    const fixNorm = eatInfo ? eatInfo.effectiveFixNorm : item.normFixBase;
    const anchors = [
      { t: item.normInit, alt: calc.initAltFt },
      { t: t25, alt: alt25 },
      { t: item.norm10, alt: inner10Alt },
      { t: item.normVor, alt: 4000 },
      { t: fixNorm, alt: 4000 },
      { t: estNorm, alt: 3000 },
      { t: estNorm + 2, alt: 0 },
    ];
    return evalPiecewiseAlt(anchors, t);
  }

  // Optional 2nd Clearance Step (after stepTimeRaw -> stepFl)
  const rawStepT = String(acft.stepTimeRaw || "").trim();
  if (isTest && rawStepT !== "" && acft.stepFl !== null && acft.stepFl !== undefined) {
    const pStep = parseTimeInput(rawStepT);
    if (pStep.valid) {
      const tStep2Norm = normalizeTime(pStep.totalMinutes, pStep.hasHour, refHour);
      if (queryNormMins > tStep2Norm) {
        const altAtStep2 = evalBasePhase1(tStep2Norm);
        const target2Ft = flInputToFeet(acft.stepFl);
        return Math.round(
          stepTowardAlt(altAtStep2, target2Ft, queryNormMins - tStep2Norm, VERT_RATE_FPM)
        );
      }
    }
  }

  return Math.round(evalBasePhase1(queryNormMins));
}

function getAircraftStateAtTime(item, solverData, queryNormMins) {
  const { acft, calc } = item;
  const eatInfo = acft.type === "ARR" || !acft.type ? solverData.eatMap.get(acft.id) : null;
  const liveAltFt = evaluatePlannedAltitude(item, eatInfo, queryNormMins, solverData.refHour);
  const altStr = formatAltShort(liveAltFt);
  const isTested = acft.flMode === "test";

  // 1. TRANSIT AIRCRAFT ('TRN')
  if (acft.type === "TRN") {
    const { entryWpt, exitWpt } = item;

    if (queryNormMins < item.normInit) {
      const wait = +(item.normInit - queryNormMins).toFixed(1);
      const { xNm, yNm } = polarToNm(calc.dist, entryWpt.deg);
      return {
        visible: false,
        underSepControl: false,
        phase: "pending",
        dme: calc.dist,
        xNm,
        yNm,
        vx: 0,
        vy: 0,
        radialDeg: entryWpt.deg,
        trackDeg: null,
        altFt: liveAltFt,
        altStr,
        isTested,
        text: `Enters ${entryWpt.name} (${calc.dist} NM) in ${wait}m @ ${altStr}`,
        color: "#64748b",
      };
    }

    // Inbound leg TO AYT VOR
    if (calc.hasInbound && queryNormMins <= item.normVor) {
      const dme = Math.max(0, +((item.normVor - queryNormMins) * SPEED_NM_PER_MIN).toFixed(2));
      const { xNm, yNm } = polarToNm(dme, entryWpt.deg);
      const svgPos = nmToSvg(xNm, yNm);
      const tipPos = polarToSvg(Math.max(0, dme - 4), entryWpt.deg);
      const trackDeg = (entryWpt.deg + 180) % 360;
      const trackRad = (trackDeg * Math.PI) / 180;
      return {
        visible: dme <= 74,
        underSepControl: dme <= 74,
        phase: "transit-in",
        x: svgPos.x,
        y: svgPos.y,
        tipX: tipPos.x,
        tipY: tipPos.y,
        xNm,
        yNm,
        vx: SPEED_NM_PER_MIN * Math.sin(trackRad),
        vy: SPEED_NM_PER_MIN * Math.cos(trackRad),
        radialDeg: entryWpt.deg,
        trackDeg,
        dme: +dme.toFixed(1),
        altFt: liveAltFt,
        altStr,
        isTested,
        text: `${+dme.toFixed(1)} NM TO AYT (${entryWpt.name} → ${exitWpt.name}) @ ${altStr}`,
        color: isTested ? "#c084fc" : "#34d399",
      };
    }

    // Outbound leg FROM AYT VOR
    if (calc.hasOutbound) {
      const dme = +((queryNormMins - item.normVor) * SPEED_NM_PER_MIN).toFixed(2);
      if (dme <= 72) {
        const { xNm, yNm } = polarToNm(dme, exitWpt.deg);
        const svgPos = nmToSvg(xNm, yNm);
        const tipPos = polarToSvg(Math.min(76, dme + 4), exitWpt.deg);
        const trackDeg = exitWpt.deg;
        const trackRad = (trackDeg * Math.PI) / 180;
        return {
          visible: true,
          underSepControl: true,
          phase: "transit-out",
          x: svgPos.x,
          y: svgPos.y,
          tipX: tipPos.x,
          tipY: tipPos.y,
          xNm,
          yNm,
          vx: SPEED_NM_PER_MIN * Math.sin(trackRad),
          vy: SPEED_NM_PER_MIN * Math.cos(trackRad),
          radialDeg: exitWpt.deg,
          trackDeg,
          dme: +dme.toFixed(1),
          altFt: liveAltFt,
          altStr,
          isTested,
          text: `${+dme.toFixed(1)} NM FROM AYT (→ ${exitWpt.name}) @ ${altStr}`,
          color: isTested ? "#c084fc" : "#34d399",
        };
      }
    }

    return {
      visible: false,
      underSepControl: false,
      phase: "exited",
      dme: 72,
      xNm: 0,
      yNm: 0,
      vx: 0,
      vy: 0,
      radialDeg: exitWpt.deg,
      trackDeg: null,
      altFt: liveAltFt,
      altStr,
      isTested,
      text: `Exited TMA (${entryWpt.name} → ${exitWpt.name})`,
      color: "#64748b",
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
        underSepControl: false,
        phase: "ground",
        dme: 0,
        xNm: 0,
        yNm: 0,
        vx: 0,
        vy: 0,
        radialDeg: wpt.deg,
        trackDeg: null,
        altFt: 0,
        altStr: "GND",
        isTested,
        text: `On ground (Departs in ${wait}m)`,
        color: "#64748b",
      };
    }

    const elapsed = queryNormMins - tDep;
    const dme = +(elapsed * SPEED_NM_PER_MIN).toFixed(2);
    const clampedDme = Math.min(dme, 72);
    const { xNm, yNm } = polarToNm(clampedDme, wpt.deg);
    const svgPos = nmToSvg(xNm, yNm);
    const tipPos = polarToSvg(Math.min(dme + 4, 76), wpt.deg);
    const trackDeg = wpt.deg;
    const trackRad = (trackDeg * Math.PI) / 180;

    return {
      visible: dme <= 72,
      underSepControl: dme <= 72,
      phase: dme <= 72 ? "outbound" : "exited",
      x: svgPos.x,
      y: svgPos.y,
      tipX: tipPos.x,
      tipY: tipPos.y,
      xNm,
      yNm,
      vx: SPEED_NM_PER_MIN * Math.sin(trackRad),
      vy: SPEED_NM_PER_MIN * Math.cos(trackRad),
      radialDeg: wpt.deg,
      trackDeg,
      dme: +dme.toFixed(1),
      altFt: liveAltFt,
      altStr,
      isTested,
      text: `${+dme.toFixed(1)} NM FROM AYT on ${wpt.name} @ ${altStr}`,
      color: isTested ? "#c084fc" : "#fbbf24",
    };
  }

  // 3. ARRIVAL AIRCRAFT ('ARR')
  const tInit = item.normInit;
  const d0 = calc.dist;

  if (queryNormMins < tInit) {
    const wait = +(tInit - queryNormMins).toFixed(1);
    const { xNm, yNm } = polarToNm(d0, wpt.deg);
    return {
      visible: false,
      underSepControl: false,
      phase: "pending",
      dme: d0,
      xNm,
      yNm,
      vx: 0,
      vy: 0,
      radialDeg: wpt.deg,
      trackDeg: null,
      altFt: liveAltFt,
      altStr,
      isTested,
      text: `Reports ${d0} NM in ${wait}m (@ ${altStr})`,
      color: "#64748b",
    };
  }

  const inbTrackDeg = (wpt.deg + 180) % 360;
  const inbTrackRad = (inbTrackDeg * Math.PI) / 180;
  const inbVx = SPEED_NM_PER_MIN * Math.sin(inbTrackRad);
  const inbVy = SPEED_NM_PER_MIN * Math.cos(inbTrackRad);

  // Straight-In Arrival Geometry
  if (calc.straightIn) {
    if (queryNormMins <= item.norm10) {
      const elapsed = queryNormMins - tInit;
      const dme = Math.max(10, +(d0 - elapsed * SPEED_NM_PER_MIN).toFixed(2));
      const { xNm, yNm } = polarToNm(dme, wpt.deg);
      const svgPos = nmToSvg(xNm, yNm);
      const tipPos = polarToSvg(Math.max(0, dme - 4), wpt.deg);
      return {
        visible: true,
        underSepControl: true,
        phase: "inbound",
        x: svgPos.x,
        y: svgPos.y,
        tipX: tipPos.x,
        tipY: tipPos.y,
        xNm,
        yNm,
        vx: inbVx,
        vy: inbVy,
        radialDeg: wpt.deg,
        trackDeg: inbTrackDeg,
        dme: +dme.toFixed(1),
        altFt: liveAltFt,
        altStr,
        isTested,
        text: `${+dme.toFixed(1)} NM TO AYT ${wpt.name} (Str-In) @ ${altStr}`,
        color: "#c084fc",
      };
    }

    if (queryNormMins <= eatInfo.effectiveEstNorm) {
      const { xNm, yNm } = polarToNm(10, wpt.deg);
      const svgPos = nmToSvg(xNm, yNm);
      return {
        visible: true,
        underSepControl: true,
        phase: "hold",
        x: svgPos.x,
        y: svgPos.y,
        tipX: svgPos.x,
        tipY: svgPos.y,
        xNm,
        yNm,
        vx: 0,
        vy: 0,
        radialDeg: wpt.deg,
        trackDeg: null,
        dme: 10,
        altFt: liveAltFt,
        altStr: `${altStr} HLD`,
        isTested,
        text: `10 NM (${wpt.name}) — Holding until EAT ${eatInfo.eatDisplay} @ ${altStr}`,
        color: "#34d399",
      };
    }

    const afterEst = +(queryNormMins - eatInfo.effectiveEstNorm).toFixed(2);
    if (afterEst <= 2) {
      const finalDme = Math.max(0, +(10 - afterEst * SPEED_NM_PER_MIN).toFixed(2));
      const { xNm, yNm } = polarToNm(finalDme, wpt.deg);
      const svgPos = nmToSvg(xNm, yNm);
      const tipPos = polarToSvg(Math.max(0, finalDme - 3), wpt.deg);
      return {
        visible: true,
        underSepControl: false, // Handed off to AYT TWR 118.1 once Full Established
        phase: "twr",
        x: svgPos.x,
        y: svgPos.y,
        tipX: tipPos.x,
        tipY: tipPos.y,
        xNm,
        yNm,
        vx: inbVx,
        vy: inbVy,
        radialDeg: wpt.deg,
        trackDeg: null,
        dme: +finalDme.toFixed(1),
        altFt: liveAltFt,
        altStr: "TWR",
        isTested,
        text: `Established w/ TWR 118.1 (${+finalDme.toFixed(1)} NM final)`,
        color: "#34d399",
      };
    }

    return {
      visible: false,
      underSepControl: false,
      phase: "landed",
      dme: 0,
      xNm: 0,
      yNm: 0,
      vx: 0,
      vy: 0,
      radialDeg: wpt.deg,
      trackDeg: null,
      altFt: 0,
      altStr: "LND",
      isTested,
      text: `Established ${+afterEst.toFixed(1)}m ago (Landed)`,
      color: "#64748b",
    };
  }

  // Normal Arrival Geometry:
  if (queryNormMins <= item.normVor) {
    const elapsed = queryNormMins - tInit;
    const dme = Math.max(0, +(d0 - elapsed * SPEED_NM_PER_MIN).toFixed(2));
    const { xNm, yNm } = polarToNm(dme, wpt.deg);
    const svgPos = nmToSvg(xNm, yNm);
    const tipPos = polarToSvg(Math.max(0, dme - 4), wpt.deg);
    return {
      visible: true,
      underSepControl: true,
      phase: "inbound",
      x: svgPos.x,
      y: svgPos.y,
      tipX: tipPos.x,
      tipY: tipPos.y,
      xNm,
      yNm,
      vx: inbVx,
      vy: inbVy,
      radialDeg: wpt.deg,
      trackDeg: inbTrackDeg,
      dme: +dme.toFixed(1),
      altFt: liveAltFt,
      altStr,
      isTested,
      text: `${+dme.toFixed(1)} NM TO AYT ${wpt.name} @ ${altStr}`,
      color: isTested ? "#c084fc" : "#38bdf8",
    };
  }

  const procDeg = state.activeRwy === "36" ? 170 : 350;
  const procRad = (procDeg * Math.PI) / 180;

  if (queryNormMins <= item.normFixBase) {
    const outElapsed = queryNormMins - item.normVor;
    const dme = +(outElapsed * SPEED_NM_PER_MIN).toFixed(2);
    const { xNm, yNm } = polarToNm(dme, procDeg);
    const svgPos = nmToSvg(xNm, yNm);
    const tipPos = polarToSvg(dme + 3.5, procDeg);
    return {
      visible: true,
      underSepControl: true,
      phase: "outbound-fix",
      x: svgPos.x,
      y: svgPos.y,
      tipX: tipPos.x,
      tipY: tipPos.y,
      xNm,
      yNm,
      vx: SPEED_NM_PER_MIN * Math.sin(procRad),
      vy: SPEED_NM_PER_MIN * Math.cos(procRad),
      radialDeg: procDeg,
      trackDeg: procDeg,
      dme: +dme.toFixed(1),
      altFt: liveAltFt,
      altStr,
      isTested,
      text: `${+dme.toFixed(1)} NM outbound to 10 DME FIX @ ${altStr}`,
      color: isTested ? "#c084fc" : "#fbbf24",
    };
  }

  if (queryNormMins <= eatInfo.effectiveFixNorm) {
    const remHold = +(eatInfo.effectiveFixNorm - queryNormMins).toFixed(1);
    const { xNm, yNm } = polarToNm(10, procDeg);
    const svgPos = nmToSvg(xNm, yNm);
    return {
      visible: true,
      underSepControl: true,
      phase: "hold",
      x: +(svgPos.x + 12).toFixed(1),
      y: +(svgPos.y + 8).toFixed(1),
      tipX: svgPos.x,
      tipY: svgPos.y,
      xNm,
      yNm,
      vx: 0,
      vy: 0,
      radialDeg: procDeg,
      trackDeg: null,
      dme: 10,
      altFt: liveAltFt,
      altStr: `${altStr} HLD`,
      isTested,
      text: `HOLDING at 10 DME FIX (${remHold}m to EAT) @ ${altStr}`,
      color: "#f87171",
    };
  }

  if (queryNormMins <= eatInfo.effectiveEstNorm) {
    const turnProgress = (queryNormMins - eatInfo.effectiveFixNorm) / 5;
    const remTurn = +(eatInfo.effectiveEstNorm - queryNormMins).toFixed(1);
    const arcDme = 10 + 3 * Math.sin(turnProgress * Math.PI);
    const arcDeg = procDeg + 12 * Math.sin(turnProgress * Math.PI);
    const { xNm, yNm } = polarToNm(arcDme, arcDeg);
    const svgPos = nmToSvg(xNm, yNm);
    const tipPos = polarToSvg(Math.max(0, arcDme - 3), procDeg);
    return {
      visible: true,
      underSepControl: true,
      phase: "turn",
      x: svgPos.x,
      y: svgPos.y,
      tipX: tipPos.x,
      tipY: tipPos.y,
      xNm,
      yNm,
      vx: 0,
      vy: 0,
      radialDeg: arcDeg,
      trackDeg: null,
      dme: +arcDme.toFixed(1),
      altFt: liveAltFt,
      altStr: `${altStr} ILS`,
      isTested,
      text: `In 5m ILS turn (${remTurn}m to Est) @ ${altStr}`,
      color: "#34d399",
    };
  }

  const afterEst = +(queryNormMins - eatInfo.effectiveEstNorm).toFixed(2);
  if (afterEst <= 2) {
    const finalDme = Math.max(0, +(10 - afterEst * SPEED_NM_PER_MIN).toFixed(2));
    const { xNm, yNm } = polarToNm(finalDme, procDeg);
    const svgPos = nmToSvg(xNm, yNm);
    const tipPos = polarToSvg(Math.max(0, finalDme - 3), procDeg);
    const finalTrack = (procDeg + 180) % 360;
    const finalTrackRad = (finalTrack * Math.PI) / 180;
    return {
      visible: true,
      underSepControl: false, // Handed off to AYT TWR 118.1
      phase: "twr",
      x: svgPos.x,
      y: svgPos.y,
      tipX: tipPos.x,
      tipY: tipPos.y,
      xNm,
      yNm,
      vx: SPEED_NM_PER_MIN * Math.sin(finalTrackRad),
      vy: SPEED_NM_PER_MIN * Math.cos(finalTrackRad),
      radialDeg: procDeg,
      trackDeg: null,
      dme: +finalDme.toFixed(1),
      altFt: liveAltFt,
      altStr: "EST/TWR",
      isTested,
      text: `Established w/ TWR 118.1 (${+finalDme.toFixed(1)} NM final)`,
      color: "#34d399",
    };
  }

  return {
    visible: false,
    underSepControl: false,
    phase: "landed",
    dme: 0,
    xNm: 0,
    yNm: 0,
    vx: 0,
    vy: 0,
    radialDeg: wpt.deg,
    trackDeg: null,
    altFt: 0,
    altStr: "LND",
    isTested,
    text: `Established ${+afterEst.toFixed(1)}m ago (Sent to TWR)`,
    color: "#64748b",
  };
}

function getAllItemsFromSolver(solver) {
  return [
    ...solver.computedArrivals,
    ...solver.computedDepartures,
    ...solver.computedTransits,
  ];
}

function getScenarioTimeBounds(solver) {
  const allItems = getAllItemsFromSolver(solver);
  if (allItems.length === 0) return { tMin: 0, tMax: 30 };

  const tMin = Math.min(
    ...allItems.map((it) => (it.acft.type === "DEP" ? it.normDep : it.normInit))
  );
  const tMax = Math.max(
    ...allItems.map((it) =>
      it.acft.type === "DEP"
        ? it.normDep + 15
        : it.acft.type === "TRN"
        ? it.norm60From || it.normVor + 14
        : (solver.eatMap.get(it.acft.id)?.effectiveEstNorm || it.normInit + 20) + 2
    )
  );
  return { tMin: Math.floor(tMin), tMax: Math.ceil(tMax) };
}

function angularDiffDeg(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function getAcftIcon(type) {
  if (type === "DEP") return "🛫";
  if (type === "TRN") return "✈️";
  return "🛬";
}

function getAcftCorridorShort(item) {
  if (item.acft.type === "TRN") return `${item.entryWpt.name}→${item.exitWpt.name}`;
  return item.wpt.name;
}

// Evaluates instantaneous pair separation & rule violations between [stA0..stA1] and [stB0..stB1]
function evaluatePairStepViolation(itemA, stA0, stA1, itemB, stB0, stB1) {
  if (!stA0.underSepControl || !stB0.underSepControl) return null;

  const altMinA = Math.min(stA0.altFt, stA1.altFt);
  const altMaxA = Math.max(stA0.altFt, stA1.altFt);
  const altMinB = Math.min(stB0.altFt, stB1.altFt);
  const altMaxB = Math.max(stB0.altFt, stB1.altFt);

  // Check if altitudes cross OR share < 1000 ft separation during this step
  const minSeparatedFt = Math.min(Math.abs(stA0.altFt - stB0.altFt), Math.abs(stA1.altFt - stB1.altFt));
  const crossesOrLacks1000 =
    Math.max(altMinA, altMinB) < Math.min(altMaxA, altMaxB) + 999.5;

  if (!crossesOrLacks1000) return null;

  // Midpoint geometry
  const xA = (stA0.xNm + stA1.xNm) / 2;
  const yA = (stA0.yNm + stA1.yNm) / 2;
  const xB = (stB0.xNm + stB1.xNm) / 2;
  const yB = (stB0.yNm + stB1.yNm) / 2;
  const dx = xB - xA;
  const dy = yB - yA;
  const horizDistNm = Math.hypot(dx, dy);

  const dmeA = Math.min(stA0.dme, stA1.dme);
  const dmeB = Math.min(stB0.dme, stB1.dme);
  const altDiffFt = Math.min(
    minSeparatedFt,
    Math.max(0, Math.max(altMinA, altMinB) - Math.min(altMaxA, altMaxB) > 0 ? Math.max(altMinA, altMinB) - Math.min(altMaxA, altMaxB) : 0)
  );

  const bothDep = itemA.acft.type === "DEP" && itemB.acft.type === "DEP";

  // 1. Check HEAD-TO-HEAD (< 45 deg off reciprocal) & < 100 NM while closing
  let isHeadToHeadViolation = false;
  let headOnOffDeg = null;
  if (stA0.trackDeg !== null && stB0.trackDeg !== null) {
    const recipA = (stA0.trackDeg + 180) % 360;
    headOnOffDeg = angularDiffDeg(recipA, stB0.trackDeg);
    if (headOnOffDeg < 45 - 1e-6) {
      const dvx = stB0.vx - stA0.vx;
      const dvy = stB0.vy - stA0.vy;
      // Closing rate toward each other in NM/min (positive = approaching, negative = diverging)
      const closingRate =
        horizDistNm > 0.05 ? -(dx * dvx + dy * dvy) / horizDistNm : bothDep ? -10 : 10;
      if (closingRate > 0.1 && horizDistNm < 100 - 1e-4) {
        isHeadToHeadViolation = true;
      }
    }
  }

  // 2. Check VOR SEPARATION (< 15 DME) — Exempt ONLY for DEP <-> DEP!
  let isVorViolation = false;
  if (!bothDep && (dmeA < 15 - 1e-4 || dmeB < 15 - 1e-4)) {
    isVorViolation = true;
  }

  // 3. Check SAME-RADIAL PROXIMITY (radials < 15 deg apart on same side, < 15 NM horiz, not DEP<->DEP)
  let isSameRadialViolation = false;
  if (!bothDep && dmeA >= 15 && dmeB >= 15 && !isHeadToHeadViolation) {
    const radDiff = angularDiffDeg(stA0.radialDeg, stB0.radialDeg);
    if (radDiff < 15 && horizDistNm < 15) {
      isSameRadialViolation = true;
    }
  }

  if (!isHeadToHeadViolation && !isVorViolation && !isSameRadialViolation) {
    return null;
  }

  return {
    isHeadToHeadViolation,
    isVorViolation,
    isSameRadialViolation,
    headOnOffDeg: headOnOffDeg !== null ? +headOnOffDeg.toFixed(0) : null,
    horizDistNm: +horizDistNm.toFixed(1),
    dmeA: +stA0.dme.toFixed(1),
    dmeB: +stB0.dme.toFixed(1),
    altA: stA0.altFt,
    altB: stB0.altFt,
    altDiffFt: Math.round(altDiffFt),
  };
}

function detect4DConflicts(solver) {
  const { refHour, useHasHour } = solver;
  const allItems = getAllItemsFromSolver(solver);
  const { tMin, tMax } = getScenarioTimeBounds(solver);

  const DT = 0.2; // 12-second precision
  const times = [];
  for (let t = tMin; t <= tMax + 1e-6; t = +(t + DT).toFixed(4)) {
    times.push(t);
  }

  if (allItems.length < 2 || times.length < 2) {
    return {
      tMin,
      tMax,
      headOnConflicts: [],
      radialConflicts: [],
      conflicts4d: [],
      heatmapBins: times.map((t) => ({ t, severity: "safe" })),
      conflictAcftIds: new Set(),
    };
  }

  // Precompute states per item across all sample steps
  const seriesMap = new Map();
  allItems.forEach((item) => {
    seriesMap.set(
      item.acft.id,
      times.map((t) => getAircraftStateAtTime(item, solver, t))
    );
  });

  const conflicts4d = [];
  const conflictAcftIds = new Set();

  // Track heatmap severity at every sample index
  const binSeverity = new Array(times.length - 1).fill("safe");

  function pushEpisode(itemA, itemB, ruleType, samples) {
    if (samples.length === 0) return;
    conflictAcftIds.add(itemA.acft.id);
    conflictAcftIds.add(itemB.acft.id);

    const tStart = samples[0].t;
    const tEnd = samples[samples.length - 1].tEnd;
    let best = samples[0];
    samples.forEach((s) => {
      if (ruleType === "HEAD_TO_HEAD") {
        if (s.horizDistNm < best.horizDistNm) best = s;
      } else {
        if (Math.min(s.dmeA, s.dmeB) < Math.min(best.dmeA, best.dmeB)) best = s;
      }
    });

    const startStr = formatTime(denormalizeTime(tStart, useHasHour, refHour), useHasHour);
    const endStr = formatTime(denormalizeTime(tEnd, useHasHour, refHour), useHasHour);
    const peakStr = formatTime(denormalizeTime(best.t, useHasHour, refHour), useHasHour);
    const windowStr = tEnd - tStart < 0.35 ? peakStr : `${startStr}–${endStr}`;

    const iconA = getAcftIcon(itemA.acft.type);
    const iconB = getAcftIcon(itemB.acft.type);
    const corrA = getAcftCorridorShort(itemA);
    const corrB = getAcftCorridorShort(itemB);

    let badgeText = "";
    let detailText = "";
    if (ruleType === "HEAD_TO_HEAD") {
      badgeText = `⚔️ H2H ${best.headOnOffDeg}° • ${best.horizDistNm} NM (<100)`;
      detailText = `<strong>${itemA.acft.callsign}</strong> (${formatAltShort(best.altA)} @ ${best.dmeA} DME) and <strong>${itemB.acft.callsign}</strong> (${formatAltShort(best.altB)} @ ${best.dmeB} DME) are head-to-head (<strong>${best.headOnOffDeg}°</strong> off reciprocal, <strong>${best.horizDistNm} NM &lt; 100 NM</strong>) crossing altitudes during <code>${windowStr}</code>.`;
    } else if (ruleType === "VOR_15DME") {
      const minDme = Math.min(best.dmeA, best.dmeB);
      badgeText = `🎯 VOR <15 DME (${minDme} NM)`;
      detailText = `Crossing/sharing altitude inside <strong>15 DME</strong> of AYT VOR (both must be ≥15 DME): <strong>${itemA.acft.callsign}</strong> at <strong>${best.dmeA} DME</strong> (${formatAltShort(best.altA)}) vs <strong>${itemB.acft.callsign}</strong> at <strong>${best.dmeB} DME</strong> (${formatAltShort(best.altB)}) at <code>${windowStr}</code>.`;
    } else {
      badgeText = `📏 SAME RADIAL (${best.horizDistNm} NM)`;
      detailText = `Same-radial proximity without 1,000' vertical separation: <strong>${itemA.acft.callsign}</strong> (${best.dmeA} DME, ${formatAltShort(best.altA)}) and <strong>${itemB.acft.callsign}</strong> (${best.dmeB} DME, ${formatAltShort(best.altB)}) only <strong>${best.horizDistNm} NM</strong> apart at <code>${windowStr}</code>.`;
    }

    conflicts4d.push({
      id: `${itemA.acft.id}-${itemB.acft.id}-${ruleType}-${tStart}`,
      ruleType,
      itemA,
      itemB,
      pairIds: [itemA.acft.id, itemB.acft.id],
      pairLabel: `${iconA} ${itemA.acft.callsign} (${corrA}) ↔ ${iconB} ${itemB.acft.callsign} (${corrB})`,
      badgeText,
      tStart,
      tEnd,
      tPeak: best.t,
      windowStr,
      peakStr,
      minHorizNm: best.horizDistNm,
      headOnOffDeg: best.headOnOffDeg,
      minDmeA: best.dmeA,
      minDmeB: best.dmeB,
      altA: best.altA,
      altB: best.altB,
      detailText,
    });
  }

  for (let i = 0; i < allItems.length; i++) {
    for (let j = i + 1; j < allItems.length; j++) {
      const itemA = allItems[i];
      const itemB = allItems[j];
      const sA = seriesMap.get(itemA.acft.id);
      const sB = seriesMap.get(itemB.acft.id);

      let activeH2h = [];
      let activeVor = [];
      let activeSame = [];

      for (let k = 0; k < times.length - 1; k++) {
        const res = evaluatePairStepViolation(
          itemA,
          sA[k],
          sA[k + 1],
          itemB,
          sB[k],
          sB[k + 1]
        );

        if (res && res.isHeadToHeadViolation) {
          activeH2h.push({ t: times[k], tEnd: times[k + 1], ...res });
          binSeverity[k] = "h2h";
        } else if (activeH2h.length > 0) {
          pushEpisode(itemA, itemB, "HEAD_TO_HEAD", activeH2h);
          activeH2h = [];
        }

        if (res && res.isVorViolation) {
          activeVor.push({ t: times[k], tEnd: times[k + 1], ...res });
          if (binSeverity[k] !== "h2h") binSeverity[k] = "vor";
        } else if (activeVor.length > 0) {
          pushEpisode(itemA, itemB, "VOR_15DME", activeVor);
          activeVor = [];
        }

        if (res && res.isSameRadialViolation) {
          activeSame.push({ t: times[k], tEnd: times[k + 1], ...res });
          if (binSeverity[k] === "safe") binSeverity[k] = "vor";
        } else if (activeSame.length > 0) {
          pushEpisode(itemA, itemB, "SAME_RADIAL", activeSame);
          activeSame = [];
        }
      }

      if (activeH2h.length > 0) pushEpisode(itemA, itemB, "HEAD_TO_HEAD", activeH2h);
      if (activeVor.length > 0) pushEpisode(itemA, itemB, "VOR_15DME", activeVor);
      if (activeSame.length > 0) pushEpisode(itemA, itemB, "SAME_RADIAL", activeSame);
    }
  }

  conflicts4d.sort((a, b) => a.tStart - b.tStart);

  // Downsample heatmap bins into ~50 crisp visual bars
  const TARGET_BINS = 54;
  const stepBin = Math.max(1, Math.floor(binSeverity.length / TARGET_BINS));
  const heatmapBins = [];
  for (let b = 0; b < binSeverity.length; b += stepBin) {
    let sev = "safe";
    for (let u = b; u < Math.min(binSeverity.length, b + stepBin); u++) {
      if (binSeverity[u] === "h2h") {
        sev = "h2h";
        break;
      }
      if (binSeverity[u] === "vor") sev = "vor";
    }
    heatmapBins.push({
      t: times[b],
      tEnd: times[Math.min(times.length - 1, b + stepBin)],
      severity: sev,
    });
  }

  return {
    tMin,
    tMax,
    headOnConflicts: conflicts4d.filter((c) => c.ruleType === "HEAD_TO_HEAD"),
    radialConflicts: conflicts4d.filter((c) => c.ruleType !== "HEAD_TO_HEAD"),
    conflicts4d,
    heatmapBins,
    conflictAcftIds,
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

// Jump the 3D/2D radar timeline cleanly to any normalized minute
function jumpChartToTime(normMins, solverHint = null) {
  const solver = solverHint || analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
  const disp = denormalizeTime(normMins, solver.useHasHour, solver.refHour);
  const formatted = solver.useHasHour
    ? formatTime(disp, true)
    : String(+disp.toFixed(1));
  state.lookupTimeRaw = formatted;

  const lookupTimeInput = document.getElementById("lookupTimeInput");
  const radarTimeSlider = document.getElementById("radarTimeSlider");
  if (lookupTimeInput) lookupTimeInput.value = formatted;
  if (radarTimeSlider) radarTimeSlider.value = normMins;

  if (state.activeView !== "chart") {
    state.activeView = "chart";
    const viewTabs = document.querySelectorAll(".view-tab");
    const viewCalc = document.getElementById("viewCalc");
    const viewChart = document.getElementById("viewChart");
    viewTabs.forEach((t) => {
      const isChart = t.getAttribute("data-view") === "chart";
      t.classList.toggle("active", isChart);
      t.setAttribute("aria-selected", isChart ? "true" : "false");
    });
    if (viewCalc) viewCalc.classList.add("hidden");
    if (viewChart) viewChart.classList.remove("hidden");
  }

  requestAnimationFrame(() => renderRadarChartView(solver));
}

// Render the 3 Conflict Finder Panels on Calculator Tab (Powered by Live 4D Engine)
function renderConflictPanels(solver) {
  const depArrListEl = document.getElementById("depArrConflictList");
  const radialConflictListEl = document.getElementById("radialConflictList");
  const ilsDelayListEl = document.getElementById("ilsDelayList");

  // 1. Head-to-Head (<45 deg off reciprocal) & <100 NM Conflicts
  if (depArrListEl) {
    if (solver.headOnConflicts.length === 0) {
      depArrListEl.innerHTML = `
        <div class="conflict-box alert-safe">
          <div class="conflict-top">
            <span class="conflict-pair">✅ Clear Head-to-Head</span>
            <span class="badge badge-nodelay">NO H2H &lt;100 NM BREACH</span>
          </div>
          <div class="conflict-detail">
            No aircraft pairs with &lt;45° head-to-head track alignment cross altitudes within 100 NM.
          </div>
        </div>
      `;
    } else {
      depArrListEl.innerHTML = "";
      solver.headOnConflicts.forEach((c) => {
        const box = document.createElement("div");
        box.className = "conflict-box alert-danger";
        box.innerHTML = `
          <div class="conflict-top">
            <span class="conflict-pair">${c.pairLabel}</span>
            <span class="badge badge-delayed">${c.badgeText}</span>
          </div>
          <div class="conflict-metrics">
            <div class="metric-pill where-pill">📍 DIST: <strong>${c.minHorizNm} NM</strong> (&lt;100)</div>
            <div class="metric-pill when-pill">⏰ WHEN: <strong>${c.windowStr}</strong></div>
            <button type="button" class="conflict-jump-btn" data-jump-t="${c.tPeak}">📡 View in 3D</button>
          </div>
          <div class="conflict-detail" style="color:var(--text-main);">
            ${c.detailText}
          </div>
        `;
        depArrListEl.appendChild(box);
      });
    }
  }

  // 2. VOR <15 DME (DEP<->DEP Exempt) & Same-Radial Conflicts
  if (radialConflictListEl) {
    radialConflictListEl.innerHTML = "";
    const radList = solver.radialConflicts || [];

    if (radList.length === 0) {
      radialConflictListEl.innerHTML = `
        <div class="conflict-box alert-safe">
          <div class="conflict-top">
            <span class="conflict-pair">✅ Clear VOR &amp; Radial Sep</span>
            <span class="badge badge-nodelay">BOTH ≥15 DME / SEPARATED</span>
          </div>
          <div class="conflict-detail">
            No VOR &lt;15 DME altitude-crossing violations (DEP↔DEP exempt) or same-radial breaches detected.
          </div>
        </div>
      `;
    } else {
      radList.forEach((rc) => {
        const box = document.createElement("div");
        box.className = "conflict-box alert-warn";
        box.innerHTML = `
          <div class="conflict-top">
            <span class="conflict-pair">${rc.pairLabel}</span>
            <span class="badge badge-eat">${rc.badgeText}</span>
          </div>
          <div class="conflict-metrics">
            <div class="metric-pill when-pill">⏰ WINDOW: <strong>${rc.windowStr}</strong></div>
            <button type="button" class="conflict-jump-btn" data-jump-t="${rc.tPeak}">📡 View in 3D</button>
          </div>
          <div class="conflict-detail" style="color:var(--text-main);">
            ${rc.detailText}
          </div>
        `;
        radialConflictListEl.appendChild(box);
      });
    }
  }

  // Wire Jump to 3D buttons inside Conflict Finder
  document.querySelectorAll(".conflict-jump-btn[data-jump-t]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tVal = parseFloat(btn.getAttribute("data-jump-t"));
      if (!Number.isNaN(tVal)) jumpChartToTime(tVal, solver);
    });
  });

  // 3. Approach Sequence & EAT Delays
  if (ilsDelayListEl) {
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
}

// ============================================================================
// VIEW 2A: STATIC 2D SVG CORRIDORS + NON-OVERLAPPING TAGS
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

// ============================================================================
// VIEW 2B: INTERACTIVE 3D AIRSPACE CANVAS ENGINE (MOBILE-FRIENDLY)
// ============================================================================
function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function render3dRadarChart(solver, queryNorm, activeNowConflicts) {
  const canvas = document.getElementById("radar3dCanvas");
  if (!canvas) return;
  const stage = document.getElementById("chart3dStage");
  if (!stage) return;

  const rect = stage.getBoundingClientRect();
  const W = rect.width || 600;
  const H = rect.height || 460;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const yawRad = (state.cam.yawDeg * Math.PI) / 180;
  const pitchDeg = Math.max(8, Math.min(89.5, state.cam.pitchDeg));
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yawRad);
  const sinYaw = Math.sin(yawRad);
  const sinPhi = Math.sin(pitchRad);
  const cosPhi = Math.cos(pitchRad);

  const camDist = 260;
  const baseScale = (Math.min(W, H) * 0.41) / 68 * state.cam.zoom;
  const centerX = W / 2 + state.cam.panX;
  const centerY = H * (0.5 + 0.11 * cosPhi) + state.cam.panY;
  const zPerFt = (40 / 40000) * state.cam.altScale; // FL400 -> 40 NM visual height * altScale

  function project(xNm, yNm, altFt) {
    const x1 = xNm * cosYaw - yNm * sinYaw;
    const y1 = xNm * sinYaw + yNm * cosYaw;
    const z = (altFt || 0) * zPerFt;
    const viewAway = y1 * cosPhi - z * sinPhi;
    const persp = camDist / Math.max(40, camDist + viewAway);
    const sx = centerX + x1 * persp * baseScale;
    const sy = centerY - (y1 * sinPhi + z * cosPhi) * persp * baseScale;
    return { x: sx, y: sy, depth: viewAway, scale: persp };
  }

  function drawCircle3d(radiusNm, altFt, strokeStyle, lineWidth = 1, dash = []) {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();
    const steps = 72;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const p = project(radiusNm * Math.sin(a), radiusNm * Math.cos(a), altFt);
      if (s === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 1. Subtle floor fill for 50 NM TMA Disc
  ctx.save();
  ctx.beginPath();
  for (let s = 0; s <= 72; s++) {
    const a = (s / 72) * Math.PI * 2;
    const p = project(50 * Math.sin(a), 50 * Math.cos(a), 0);
    if (s === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(30, 52, 92, 0.22)";
  ctx.fill();
  ctx.restore();

  // Distance rings on floor (0 ft)
  drawCircle3d(60, 0, "rgba(71, 104, 158, 0.25)", 1, [4, 6]);
  drawCircle3d(50, 0, "rgba(71, 104, 158, 0.65)", 1.8, []);
  drawCircle3d(25, 0, "rgba(56, 189, 248, 0.35)", 1.2, [5, 4]);
  drawCircle3d(10, 0, "rgba(52, 211, 153, 0.28)", 1, [2, 4]);

  // 2. 15 DME VOR SEPARATION CYLINDER (Highlights RED if active VOR < 15 DME breach!)
  const hasVorBreachNow = activeNowConflicts.some(
    (c) => c.ruleType === "VOR_15DME"
  );
  const cylTopAlt = 36000;
  const cylColor = hasVorBreachNow
    ? "rgba(248, 113, 113, 0.65)"
    : "rgba(251, 191, 36, 0.38)";
  const cylFill = hasVorBreachNow
    ? "rgba(248, 113, 113, 0.09)"
    : "rgba(251, 191, 36, 0.045)";

  // Translucent cylinder wall quads (front + back simplified)
  if (cosPhi > 0.12) {
    ctx.save();
    const cylSegs = 36;
    for (let s = 0; s < cylSegs; s++) {
      const a0 = (s / cylSegs) * Math.PI * 2;
      const a1 = ((s + 1) / cylSegs) * Math.PI * 2;
      const b0 = project(15 * Math.sin(a0), 15 * Math.cos(a0), 0);
      const b1 = project(15 * Math.sin(a1), 15 * Math.cos(a1), 0);
      const t1 = project(15 * Math.sin(a1), 15 * Math.cos(a1), cylTopAlt);
      const t0 = project(15 * Math.sin(a0), 15 * Math.cos(a0), cylTopAlt);
      ctx.beginPath();
      ctx.moveTo(b0.x, b0.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t0.x, t0.y);
      ctx.closePath();
      ctx.fillStyle = cylFill;
      ctx.fill();
    }
    ctx.restore();
  }

  drawCircle3d(15, 0, cylColor, 1.5, [3, 3]);
  if (cosPhi > 0.15) {
    drawCircle3d(15, 10000, hasVorBreachNow ? "rgba(248, 113, 113, 0.3)" : "rgba(251, 191, 36, 0.18)", 1, [3, 4]);
    drawCircle3d(15, 20000, hasVorBreachNow ? "rgba(248, 113, 113, 0.28)" : "rgba(251, 191, 36, 0.15)", 1, [3, 4]);
    drawCircle3d(15, cylTopAlt, cylColor, 1.1, [3, 4]);
    for (let deg = 0; deg < 360; deg += 90) {
      const rad = (deg * Math.PI) / 180;
      const pBot = project(15 * Math.sin(rad), 15 * Math.cos(rad), 0);
      const pTop = project(15 * Math.sin(rad), 15 * Math.cos(rad), cylTopAlt);
      ctx.strokeStyle = hasVorBreachNow
        ? "rgba(248, 113, 113, 0.28)"
        : "rgba(251, 191, 36, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pBot.x, pBot.y);
      ctx.lineTo(pTop.x, pTop.y);
      ctx.stroke();
    }
  }

  // Label for 15 DME VOR Cylinder
  const p15Lbl = project(0, 15, cylTopAlt * 0.92);
  ctx.fillStyle = hasVorBreachNow ? "#fca5a5" : "rgba(251, 191, 36, 0.8)";
  ctx.font = "700 10px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText(hasVorBreachNow ? "⚠ 15 DME VOR BREACH" : "15 DME VOR SEP", p15Lbl.x, p15Lbl.y - 4);

  // 3. Radial Airways & Waypoints on Floor
  WAYPOINTS.forEach((wpt) => {
    const pOuter = polarToNm(66, wpt.deg);
    const pTma = polarToNm(50, wpt.deg);
    const pCenter = { xNm: 0, yNm: 0 };

    const sOuter = project(pOuter.xNm, pOuter.yNm, 0);
    const sTma = project(pTma.xNm, pTma.yNm, 0);
    const sCtr = project(pCenter.xNm, pCenter.yNm, 0);

    // Outer dotted
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sOuter.x, sOuter.y);
    ctx.lineTo(sTma.x, sTma.y);
    ctx.stroke();

    // Inner TMA track
    ctx.strokeStyle = "rgba(248, 113, 113, 0.42)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(sTma.x, sTma.y);
    ctx.lineTo(sCtr.x, sCtr.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint diamond + label
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(sTma.x, sTma.y, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const pLbl = polarToNm(57, wpt.deg);
    const sLbl = project(pLbl.xNm, pLbl.yNm, 0);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "800 10px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(wpt.name, sLbl.x, sLbl.y + 3);

    const pEntryLbl = polarToNm(69, wpt.deg);
    const sEntryLbl = project(pEntryLbl.xNm, pEntryLbl.yNm, 0);
    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.font = "700 9px JetBrains Mono, monospace";
    ctx.fillText(wpt.entryWpt, sEntryLbl.x, sEntryLbl.y + 3);
  });

  // 4. Center AYT VOR Marker & Vertical Altitude Scale Post
  const sVor = project(0, 0, 0);
  ctx.fillStyle = "#38bdf8";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.8;
  ctx.strokeRect(sVor.x - 5, sVor.y - 5, 10, 10);
  ctx.beginPath();
  ctx.arc(sVor.x, sVor.y, 2, 0, Math.PI * 2);
  ctx.fill();

  if (cosPhi > 0.12) {
    const sPoleTop = project(0, 0, 36000);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(sVor.x, sVor.y);
    ctx.lineTo(sPoleTop.x, sPoleTop.y);
    ctx.stroke();
    ctx.setLineDash([]);

    [10000, 20000, 30000].forEach((alt) => {
      const pTick = project(0, 0, alt);
      ctx.fillStyle = "rgba(148, 163, 184, 0.72)";
      ctx.font = "700 9px JetBrains Mono, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`FL${alt / 100}`, pTick.x + 5, pTick.y + 3);
    });
  }

  // Runway 36/18 Centerline indicator on VOR floor
  const rwyDeg = state.activeRwy === "36" ? 0 : 180;
  const rwyP1 = polarToNm(8, rwyDeg);
  const rwyP2 = polarToNm(8, (rwyDeg + 180) % 360);
  const sr1 = project(rwyP1.xNm, rwyP1.yNm, 0);
  const sr2 = project(rwyP2.xNm, rwyP2.yNm, 0);
  ctx.strokeStyle = "rgba(52, 211, 153, 0.75)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(sr2.x, sr2.y);
  ctx.lineTo(sr1.x, sr1.y);
  ctx.stroke();

  // 5. Build 3D Trajectories & Aircraft Blip Items for Depth Sorting
  const allItems = getAllItemsFromSolver(solver);
  const { tMin, tMax } = getScenarioTimeBounds(solver);
  const drawables = [];
  const stateAtNow = new Map();

  // Conflicting pairs happening right at queryNorm
  const nowConflictAcftIds = new Set();
  activeNowConflicts.forEach((c) => {
    nowConflictAcftIds.add(c.itemA.acft.id);
    nowConflictAcftIds.add(c.itemB.acft.id);
  });

  allItems.forEach((item) => {
    const stNow = getAircraftStateAtTime(item, solver, queryNorm);
    stateAtNow.set(item.acft.id, stNow);

    const isSelected = state.selectedTestAcftId === item.acft.id;
    const isTested = item.acft.flMode === "test";
    const inConflictNow = nowConflictAcftIds.has(item.acft.id);

    // Build full trajectory ribbon samples for selected, tested, conflicting, or visible aircraft
    const trajSamples = [];
    const startT = item.acft.type === "DEP" ? item.normDep : item.normInit;
    const endT =
      item.acft.type === "DEP"
        ? item.normDep + 14
        : item.acft.type === "TRN"
        ? item.normVor + 14
        : (solver.eatMap.get(item.acft.id)?.effectiveEstNorm || startT + 20) + 1;

    const span = Math.max(2, endT - startT);
    const steps = 28;
    for (let s = 0; s <= steps; s++) {
      const ts = startT + (span * s) / steps;
      const stS = getAircraftStateAtTime(item, solver, ts);
      if (stS.visible) {
        trajSamples.push({ t: ts, st: stS });
      }
    }

    if (trajSamples.length >= 2) {
      const midSample = trajSamples[Math.floor(trajSamples.length / 2)];
      const midProj = project(midSample.st.xNm, midSample.st.yNm, midSample.st.altFt);
      drawables.push({
        kind: "trajectory",
        depth: midProj.depth + 5, // Slightly behind plane blips
        item,
        trajSamples,
        color: inConflictNow
          ? "#f87171"
          : isSelected || isTested
          ? stNow.color
          : item.acft.type === "DEP"
          ? "#fbbf24"
          : item.acft.type === "TRN"
          ? "#34d399"
          : "#38bdf8",
        emphasis: isSelected || inConflictNow || stNow.visible,
      });
    }

    if (stNow.visible) {
      const proj3d = project(stNow.xNm, stNow.yNm, stNow.altFt);
      const projFloor = project(stNow.xNm, stNow.yNm, 0);
      drawables.push({
        kind: "aircraft",
        depth: proj3d.depth - 0.5,
        item,
        st: stNow,
        proj3d,
        projFloor,
        isSelected,
        inConflictNow,
      });
    }
  });

  // Draw active 3D conflict laser lines at current Time T
  activeNowConflicts.forEach((c) => {
    const stA = stateAtNow.get(c.itemA.acft.id);
    const stB = stateAtNow.get(c.itemB.acft.id);
    if (!stA || !stB || !stA.visible || !stB.visible) return;
    const pA = project(stA.xNm, stA.yNm, stA.altFt);
    const pB = project(stB.xNm, stB.yNm, stB.altFt);
    const dx = stB.xNm - stA.xNm;
    const dy = stB.yNm - stA.yNm;
    const distNm = Math.hypot(dx, dy).toFixed(1);
    drawables.push({
      kind: "conflict-beam",
      depth: (pA.depth + pB.depth) / 2 - 2,
      conflict: c,
      pA,
      pB,
      distNm,
    });
  });

  // Sort back-to-front (largest `depth` = furthest away -> draw first)
  drawables.sort((a, b) => b.depth - a.depth);

  const projectedBlips3d = [];
  const labelQueue = [];

  drawables.forEach((d) => {
    if (d.kind === "trajectory") {
      const alpha = d.emphasis ? 0.55 : 0.18;
      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = state.selectedTestAcftId === d.item.acft.id ? 2.4 : 1.4;
      ctx.beginPath();
      d.trajSamples.forEach((sp, idx) => {
        const p = project(sp.st.xNm, sp.st.yNm, sp.st.altFt);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Subtle vertical curtain ribs down to floor for highlighted planes
      if (d.emphasis && cosPhi > 0.15) {
        ctx.globalAlpha = state.selectedTestAcftId === d.item.acft.id ? 0.24 : 0.1;
        ctx.lineWidth = 1;
        for (let k = 0; k < d.trajSamples.length; k += 4) {
          const sp = d.trajSamples[k];
          const pTop = project(sp.st.xNm, sp.st.yNm, sp.st.altFt);
          const pBot = project(sp.st.xNm, sp.st.yNm, 0);
          ctx.beginPath();
          ctx.moveTo(pTop.x, pTop.y);
          ctx.lineTo(pBot.x, pBot.y);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    if (d.kind === "conflict-beam") {
      const isH2h = d.conflict.ruleType === "HEAD_TO_HEAD";
      const beamColor = isH2h ? "#f87171" : "#fbbf24";
      ctx.save();
      ctx.strokeStyle = beamColor;
      ctx.lineWidth = 2.6;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(d.pA.x, d.pA.y);
      ctx.lineTo(d.pB.x, d.pB.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Midpoint distance pill
      const mx = (d.pA.x + d.pB.x) / 2;
      const my = (d.pA.y + d.pB.y) / 2;
      const lbl = isH2h ? `⚔️ ${d.distNm} NM H2H` : `🎯 VOR <15 DME`;
      ctx.font = "800 10px JetBrains Mono, monospace";
      const tw = ctx.measureText(lbl).width + 12;
      ctx.fillStyle = isH2h ? "rgba(127, 29, 29, 0.92)" : "rgba(120, 53, 15, 0.92)";
      ctx.strokeStyle = beamColor;
      ctx.lineWidth = 1.2;
      roundRectPath(ctx, mx - tw / 2, my - 9, tw, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(lbl, mx, my + 3.5);
      ctx.restore();
      return;
    }

    if (d.kind === "aircraft") {
      const { item, st, proj3d, projFloor, isSelected, inConflictNow } = d;
      const blipColor = inConflictNow ? "#f87171" : st.color;

      // Ground shadow dot & vertical plumb line stalk
      ctx.save();
      ctx.fillStyle = blipColor;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(projFloor.x, projFloor.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = blipColor;
      ctx.globalAlpha = isSelected ? 0.85 : 0.48;
      ctx.lineWidth = isSelected ? 1.8 : 1.1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(projFloor.x, projFloor.y);
      ctx.lineTo(proj3d.x, proj3d.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Highlight ring if Selected or Conflicting
      if (isSelected || inConflictNow) {
        ctx.save();
        ctx.strokeStyle = inConflictNow ? "#f87171" : "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(proj3d.x, proj3d.y, isSelected ? 11 : 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3D Aircraft Diamond Marker
      ctx.save();
      ctx.translate(proj3d.x, proj3d.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#0b111e";
      ctx.strokeStyle = blipColor;
      ctx.lineWidth = 2.4;
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.strokeRect(-5.5, -5.5, 11, 11);
      ctx.restore();

      // Heading vector nose tip in 3D
      if (st.trackDeg !== null) {
        const noseRad = (st.trackDeg * Math.PI) / 180;
        const tip3d = project(
          st.xNm + 3.8 * Math.sin(noseRad),
          st.yNm + 3.8 * Math.cos(noseRad),
          st.altFt
        );
        ctx.strokeStyle = blipColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(proj3d.x, proj3d.y);
        ctx.lineTo(tip3d.x, tip3d.y);
        ctx.stroke();
      }

      // Queue Callsign & FL / DME Label Tag for collision separation pass
      const line1 = `${item.acft.callsign}${item.acft.flMode === "test" ? " ★" : ""}`;
      const line2 = `${st.altStr} • ${st.dme}NM`;
      ctx.font = "800 10.5px JetBrains Mono, monospace";
      const w1 = ctx.measureText(line1).width;
      ctx.font = "700 9.5px JetBrains Mono, monospace";
      const w2 = ctx.measureText(line2).width;
      const tagW = Math.max(w1, w2) + 12;
      const tagH = 29;
      const tx = Math.max(6, Math.min(W - tagW - 6, proj3d.x + 12));
      const ty = Math.max(44, Math.min(H - tagH - 36, proj3d.y - 16));

      labelQueue.push({
        id: item.acft.id,
        sx: proj3d.x,
        sy: proj3d.y,
        tx,
        ty,
        tw: tagW,
        th: tagH,
        line1,
        line2,
        blipColor,
        isSelected,
      });
    }
  });

  // Fast iterative 2D tag de-overlap pass on projected 3D labels
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (let i = 0; i < labelQueue.length; i++) {
      for (let j = i + 1; j < labelQueue.length; j++) {
        const A = labelQueue[i];
        const B = labelQueue[j];
        const pad = 5;
        const ovX = (A.tw + B.tw) / 2 + pad - Math.abs(A.tx + A.tw / 2 - (B.tx + B.tw / 2));
        const ovY = (A.th + B.th) / 2 + pad - Math.abs(A.ty + A.th / 2 - (B.ty + B.th / 2));
        if (ovX > 0 && ovY > 0) {
          moved = true;
          if (ovY <= ovX * 1.4) {
            const dir = A.ty <= B.ty ? -1 : 1;
            A.ty = Math.max(44, Math.min(H - A.th - 36, A.ty + (dir * ovY) / 2));
            B.ty = Math.max(44, Math.min(H - B.th - 36, B.ty - (dir * ovY) / 2));
          } else {
            const dir = A.tx <= B.tx ? -1 : 1;
            A.tx = Math.max(6, Math.min(W - A.tw - 6, A.tx + (dir * ovX) / 2));
            B.tx = Math.max(6, Math.min(W - B.tw - 6, B.tx - (dir * ovX) / 2));
          }
        }
      }
    }
    if (!moved) break;
  }

  // Draw leader lines & de-overlapped 3D labels
  labelQueue.forEach((lbl) => {
    const anchor = getRectPerimeterAnchor(lbl.sx, lbl.sy, lbl.tx, lbl.ty, lbl.tw, lbl.th);
    ctx.save();
    ctx.strokeStyle = lbl.blipColor;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lbl.sx, lbl.sy);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = lbl.isSelected ? "rgba(30, 58, 138, 0.94)" : "rgba(9, 14, 26, 0.9)";
    ctx.strokeStyle = lbl.blipColor;
    ctx.lineWidth = lbl.isSelected ? 1.8 : 1.1;
    roundRectPath(ctx, lbl.tx, lbl.ty, lbl.tw, lbl.th, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = lbl.blipColor;
    ctx.font = "800 10.5px JetBrains Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(lbl.line1, lbl.tx + 6, lbl.ty + 12);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "700 9.5px JetBrains Mono, monospace";
    ctx.fillText(lbl.line2, lbl.tx + 6, lbl.ty + 23.5);
    ctx.restore();

    projectedBlips3d.push({
      id: lbl.id,
      sx: lbl.sx,
      sy: lbl.sy,
      tx: lbl.tx,
      ty: lbl.ty,
      tw: lbl.tw,
      th: lbl.th,
    });
  });

  state.projectedBlips3d = projectedBlips3d;

  // Floating 3D Canvas Conflict Alert Banner
  const bannerEl = document.getElementById("canvas3dConflictBanner");
  if (bannerEl) {
    if (activeNowConflicts.length === 0) {
      bannerEl.classList.add("hidden");
    } else {
      bannerEl.classList.remove("hidden");
      bannerEl.innerHTML = activeNowConflicts
        .slice(0, 2)
        .map((c) => `<div>${c.badgeText}: ${c.pairLabel}</div>`)
        .join("");
    }
  }
}

// ============================================================================
// VIEW 2C: INTERACTIVE FLIGHT LEVEL TESTER + CONFLICT DETECTOR FEED + HEATMAP
// ============================================================================
function renderConflictHeatmapBar(solver, queryNorm) {
  const bar = document.getElementById("conflictHeatmapBar");
  if (!bar) return;
  const bins = solver.heatmapBins || [];
  if (bins.length === 0) {
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = bins
    .map((b) => {
      const isNow = queryNorm >= b.t && queryNorm <= b.tEnd + 0.15;
      const tDisp = formatTime(
        denormalizeTime(b.t, solver.useHasHour, solver.refHour),
        solver.useHasHour
      );
      return `<div class="heatmap-cell ${b.severity} ${
        isNow ? "active-now" : ""
      }" data-heat-t="${b.t}" title="${tDisp} (${b.severity.toUpperCase()})"></div>`;
    })
    .join("");

  bar.querySelectorAll(".heatmap-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const tVal = parseFloat(cell.getAttribute("data-heat-t"));
      if (!Number.isNaN(tVal)) jumpChartToTime(tVal, solver);
    });
  });
}

function renderFlTesterPanel(solver, queryNorm) {
  const pillsEl = document.getElementById("flTesterPlanePills");
  const editorEl = document.getElementById("flTesterEditor");
  if (!pillsEl || !editorEl) return;

  const allItems = getAllItemsFromSolver(solver);
  if (allItems.length === 0) {
    pillsEl.innerHTML = "";
    editorEl.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);">Add aircraft or import a scenario to test Flight Levels and detect separation conflicts live.</div>`;
    return;
  }

  if (
    !state.selectedTestAcftId ||
    !allItems.some((it) => it.acft.id === state.selectedTestAcftId)
  ) {
    state.selectedTestAcftId = allItems[0].acft.id;
  }

  const conflictIds = solver.conflictAcftIds || new Set();

  pillsEl.innerHTML = allItems
    .map((it) => {
      const st = getAircraftStateAtTime(it, solver, queryNorm);
      const isSel = it.acft.id === state.selectedTestAcftId;
      const hasConf = conflictIds.has(it.acft.id);
      const isTested = it.acft.flMode === "test";
      const dot = hasConf ? "🔴" : st.visible ? "🟢" : "⚪";
      return `
        <button type="button" class="fl-plane-pill ${isSel ? "selected" : ""} ${
        hasConf ? "has-conflict" : ""
      } ${isTested ? "tested-badge" : ""}" data-select-acft="${it.acft.id}">
          <span>${dot}</span>
          <span>${it.acft.callsign}</span>
          <span style="color:var(--text-muted)">${st.altStr}</span>
        </button>
      `;
    })
    .join("");

  pillsEl.querySelectorAll("[data-select-acft]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedTestAcftId = Number(btn.getAttribute("data-select-acft"));
      renderRadarChartView(solver);
    });
  });

  const selItem = allItems.find((it) => it.acft.id === state.selectedTestAcftId);
  if (!selItem) return;
  const acft = selItem.acft;
  const stNow = getAircraftStateAtTime(selItem, solver, queryNorm);
  const corr = getAcftCorridorShort(selItem);
  const wptObj = selItem.wpt || selItem.entryWpt || WAYPOINTS[0];
  const currentTestFl = Number(acft.testFl ?? acft.fl) || 150;
  const isTestMode = acft.flMode === "test";

  const presetValues =
    acft.type === "DEP"
      ? [
          { lbl: `MSA (${Math.round(wptObj.msaFt / 100)})`, val: Math.round(wptObj.msaFt / 100) },
          { lbl: `MEA (${Math.round(wptObj.meaFt / 100)})`, val: Math.round(wptObj.meaFt / 100) },
          { lbl: "FL130", val: 130 },
          { lbl: "FL150", val: 150 },
          { lbl: `Req FL${acft.fl}`, val: acft.fl },
        ]
      : acft.type === "TRN"
      ? [
          { lbl: `Orig FL${acft.fl}`, val: acft.fl },
          { lbl: "FL130", val: 130 },
          { lbl: "FL140", val: 140 },
          { lbl: "FL150", val: 150 },
          { lbl: "FL160", val: 160 },
        ]
      : [
          { lbl: `Init FL${acft.fl}`, val: acft.fl },
          { lbl: `MEA (${Math.round(wptObj.meaFt / 100)})`, val: Math.round(wptObj.meaFt / 100) },
          { lbl: "FL150", val: 150 },
          { lbl: "FL140", val: 140 },
          { lbl: `MSA (${Math.round(wptObj.msaFt / 100)})`, val: Math.round(wptObj.msaFt / 100) },
          { lbl: "4,000'", val: 40 },
          { lbl: "3,000'", val: 30 },
        ];

  const hasStep2 = String(acft.stepTimeRaw || "").trim() !== "" && acft.stepFl !== null;
  const nowDisp = formatTime(
    denormalizeTime(queryNorm, solver.useHasHour, solver.refHour),
    solver.useHasHour
  );

  editorEl.innerHTML = `
    <div class="fl-editor-top">
      <div>
        <strong>${getAcftIcon(acft.type)} ${acft.callsign}</strong>
        <span class="step-delta" id="flEditorNowInfo">(${corr}) • Now: <strong>${stNow.altStr}</strong> @ ${stNow.dme} DME</span>
      </div>
      <div class="fl-mode-switch">
        <button type="button" class="fl-mode-btn ${!isTestMode ? "active" : ""}" data-flmode="auto">Auto Proc</button>
        <button type="button" class="fl-mode-btn ${isTestMode ? "active" : ""}" data-flmode="test">🧪 Test FL</button>
      </div>
    </div>

    <div class="fl-step-control-row">
      <button type="button" class="fl-big-step-btn" data-fl-delta="-20">-20</button>
      <button type="button" class="fl-big-step-btn" data-fl-delta="-10">-10</button>
      <div class="fl-input-wrap" style="flex:1;min-width:94px;">
        <span class="fl-prefix">FL</span>
        <input type="number" id="testerFlInput" value="${currentTestFl}" min="30" max="420" step="10" aria-label="Test Flight Level" />
      </div>
      <button type="button" class="fl-big-step-btn" data-fl-delta="10">+10</button>
      <button type="button" class="fl-big-step-btn" data-fl-delta="20">+20</button>
    </div>

    <input type="range" id="testerFlSlider" class="fl-test-slider" min="30" max="400" step="10" value="${Math.max(
      30,
      Math.min(400, currentTestFl)
    )}" aria-label="Test Flight Level Slider" />

    <div class="fl-quick-presets">
      ${presetValues
        .map(
          (p) =>
            `<button type="button" class="small-btn tester-preset-btn" data-preset-fl="${p.val}">${p.lbl}</button>`
        )
        .join("")}
    </div>

    <div class="fl-step2-box">
      <div class="fl-step2-row">
        <span><strong>Step 2 Clearance</strong> (optional): After time</span>
        <input type="text" id="testerStepTimeInput" class="inline-input inline-time" value="${
          acft.stepTimeRaw || ""
        }" placeholder="${nowDisp}" title="Time when next FL clearance starts" />
        <span>→ FL</span>
        <input type="number" id="testerStepFlInput" class="inline-input inline-fl" value="${
          acft.stepFl ?? acft.fl
        }" min="30" max="420" step="10" />
        <button type="button" id="btnSetStep2Now" class="small-btn" title="Set Step 2 trigger to current scrub time ${nowDisp}">@ Now (${nowDisp})</button>
        ${
          hasStep2
            ? `<button type="button" id="btnClearStep2" class="small-btn danger-btn">✕</button>`
            : ""
        }
      </div>
    </div>
  `;

  function applyFlUpdate(nextFl, forceTestMode = true) {
    acft.testFl = Math.max(30, Math.min(450, Number(nextFl) || 100));
    if (forceTestMode) acft.flMode = "test";
    saveState();
    const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
    renderConflictPanels(newSolver);
    renderRadarChartView(newSolver);
  }

  editorEl.querySelectorAll("[data-flmode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      acft.flMode = btn.getAttribute("data-flmode");
      if (acft.flMode === "test" && (acft.testFl === undefined || acft.testFl === null)) {
        acft.testFl = acft.fl;
      }
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartView(newSolver);
    });
  });

  editorEl.querySelectorAll("[data-fl-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.getAttribute("data-fl-delta"));
      applyFlUpdate(currentTestFl + delta, true);
    });
  });

  editorEl.querySelectorAll("[data-preset-fl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = Number(btn.getAttribute("data-preset-fl"));
      applyFlUpdate(val, true);
    });
  });

  const testerFlInput = document.getElementById("testerFlInput");
  const testerFlSlider = document.getElementById("testerFlSlider");
  if (testerFlInput) {
    testerFlInput.addEventListener("change", () => applyFlUpdate(testerFlInput.value, true));
  }
  if (testerFlSlider) {
    testerFlSlider.addEventListener("input", () => {
      const v = Number(testerFlSlider.value);
      if (testerFlInput) testerFlInput.value = v;
      acft.testFl = v;
      acft.flMode = "test";
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartOnlyVisuals(newSolver);
    });
  }

  const testerStepTimeInput = document.getElementById("testerStepTimeInput");
  const testerStepFlInput = document.getElementById("testerStepFlInput");
  const btnSetStep2Now = document.getElementById("btnSetStep2Now");
  const btnClearStep2 = document.getElementById("btnClearStep2");

  if (testerStepTimeInput) {
    testerStepTimeInput.addEventListener("change", () => {
      acft.stepTimeRaw = testerStepTimeInput.value.trim();
      if (acft.stepTimeRaw && (acft.stepFl === null || acft.stepFl === undefined)) {
        acft.stepFl = Number(testerStepFlInput?.value) || acft.fl;
      }
      if (acft.stepTimeRaw) acft.flMode = "test";
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartView(newSolver);
    });
  }

  if (testerStepFlInput) {
    testerStepFlInput.addEventListener("change", () => {
      acft.stepFl = Number(testerStepFlInput.value) || acft.fl;
      if (acft.stepTimeRaw) acft.flMode = "test";
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartView(newSolver);
    });
  }

  if (btnSetStep2Now) {
    btnSetStep2Now.addEventListener("click", () => {
      acft.stepTimeRaw = nowDisp;
      acft.stepFl = Number(testerStepFlInput?.value) || acft.fl;
      acft.flMode = "test";
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartView(newSolver);
    });
  }

  if (btnClearStep2) {
    btnClearStep2.addEventListener("click", () => {
      acft.stepTimeRaw = "";
      acft.stepFl = null;
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartView(newSolver);
    });
  }
}

function renderChartConflictFeed(solver, queryNorm, activeNowConflicts) {
  const feedEl = document.getElementById("chartConflictFeed");
  const pillEl = document.getElementById("liveConflictBadge");
  const list = solver.conflicts4d || [];

  if (pillEl) {
    if (list.length === 0) {
      pillEl.className = "live-conflict-pill clear";
      pillEl.textContent = "✅ 0 Conflicts";
    } else {
      pillEl.className = "live-conflict-pill danger";
      pillEl.textContent = `🚨 ${list.length} Conflict${list.length > 1 ? "s" : ""}${
        activeNowConflicts.length > 0 ? ` (${activeNowConflicts.length} NOW)` : ""
      }`;
    }
  }

  if (!feedEl) return;
  const shown = state.conflictScope === "now" ? activeNowConflicts : list;

  if (shown.length === 0) {
    feedEl.innerHTML = `
      <div class="conflict-box alert-safe">
        <div class="conflict-detail">
          ${
            state.conflictScope === "now"
              ? "✅ No conflicts occurring at this exact timestamp."
              : "✅ No Head-to-Head (<45° & <100 NM) or VOR (<15 DME) conflicts detected!"
          }
        </div>
      </div>
    `;
    return;
  }

  feedEl.innerHTML = shown
    .map(
      (c) => `
      <div class="conflict-box ${c.ruleType === "HEAD_TO_HEAD" ? "alert-danger" : "alert-warn"}">
        <div class="conflict-top">
          <span class="conflict-pair">${c.pairLabel}</span>
          <span class="badge ${c.ruleType === "HEAD_TO_HEAD" ? "badge-delayed" : "badge-eat"}">${
        c.badgeText
      }</span>
        </div>
        <div class="conflict-metrics">
          <div class="metric-pill when-pill">⏰ <strong>${c.windowStr}</strong></div>
          <button type="button" class="conflict-jump-btn" data-feed-jump-t="${c.tPeak}">📍 Go @ ${c.peakStr}</button>
        </div>
        <div class="conflict-detail" style="color:var(--text-main);">${c.detailText}</div>
      </div>
    `
    )
    .join("");

  feedEl.querySelectorAll("[data-feed-jump-t]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tVal = parseFloat(btn.getAttribute("data-feed-jump-t"));
      if (!Number.isNaN(tVal)) jumpChartToTime(tVal, solver);
    });
  });
}

// Fast visual refresh used while dragging the FL slider smoothly without destroying focus
function renderRadarChartOnlyVisuals(solver) {
  const slider = document.getElementById("radarTimeSlider");
  const parsedQuery = parseTimeInput(state.lookupTimeRaw);
  let queryNorm = parsedQuery.totalMinutes;
  if (solver.refHour !== null && !parsedQuery.hasHour && queryNorm < 120) {
    queryNorm = solver.refHour * 60 + queryNorm;
  }
  const activeNowConflicts = (solver.conflicts4d || []).filter(
    (c) => queryNorm >= c.tStart - 0.12 && queryNorm <= c.tEnd + 0.12
  );
  if (slider) {
    slider.min = solver.tMin;
    slider.max = solver.tMax;
    slider.value = queryNorm;
  }
  if (state.chartMode === "3d") {
    render3dRadarChart(solver, queryNorm, activeNowConflicts);
  }
  renderConflictHeatmapBar(solver, queryNorm);
  renderChartConflictFeed(solver, queryNorm, activeNowConflicts);

  // Sync live status labels inside FL Tester without rebuilding slider DOM
  const allItems = getAllItemsFromSolver(solver);
  const conflictIds = solver.conflictAcftIds || new Set();
  allItems.forEach((it) => {
    const st = getAircraftStateAtTime(it, solver, queryNorm);
    const pill = document.querySelector(`[data-select-acft="${it.acft.id}"]`);
    if (pill) {
      const hasConf = conflictIds.has(it.acft.id);
      pill.classList.toggle("has-conflict", hasConf);
      pill.classList.toggle("tested-badge", it.acft.flMode === "test");
      const spans = pill.querySelectorAll("span");
      if (spans[0]) spans[0].textContent = hasConf ? "🔴" : st.visible ? "🟢" : "⚪";
      if (spans[2]) spans[2].textContent = st.altStr;
    }
    if (it.acft.id === state.selectedTestAcftId) {
      const infoEl = document.getElementById("flEditorNowInfo");
      if (infoEl) {
        infoEl.innerHTML = `(${getAcftCorridorShort(it)}) • Now: <strong>${st.altStr}</strong> @ ${st.dme} DME`;
      }
      document.querySelectorAll("[data-flmode]").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-flmode") === it.acft.flMode);
      });
    }
  });
}

function renderRadarChartView(solver) {
  const blipsLayer = document.getElementById("svgBlipsLayer");
  const listEl = document.getElementById("positionSnapshotList");
  const sidebarTimeLabel = document.getElementById("sidebarTimeLabel");
  const slider = document.getElementById("radarTimeSlider");
  const stage3d = document.getElementById("chart3dStage");
  const stage2d = document.getElementById("chart2dStage");

  if (!listEl) return;

  if (stage3d) stage3d.classList.toggle("hidden", state.chartMode !== "3d");
  if (stage2d) stage2d.classList.toggle("hidden", state.chartMode !== "2d");

  const allItems = getAllItemsFromSolver(solver);

  const parsedQuery = parseTimeInput(state.lookupTimeRaw);
  let queryNorm = parsedQuery.totalMinutes;
  if (solver.refHour !== null && !parsedQuery.hasHour && queryNorm < 120) {
    queryNorm = solver.refHour * 60 + queryNorm;
  }

  if (allItems.length > 0 && slider) {
    slider.min = solver.tMin;
    slider.max = solver.tMax;
    slider.value = queryNorm;
  }

  if (sidebarTimeLabel) {
    sidebarTimeLabel.textContent = formatTime(
      denormalizeTime(queryNorm, solver.useHasHour, solver.refHour),
      solver.useHasHour
    );
  }

  const activeNowConflicts = (solver.conflicts4d || []).filter(
    (c) => queryNorm >= c.tStart - 0.12 && queryNorm <= c.tEnd + 0.12
  );

  // Render 3D interactive chart, Heatmap, FL Tester, Conflict Feed, & 2D SVG
  if (state.chartMode === "3d") {
    render3dRadarChart(solver, queryNorm, activeNowConflicts);
  }
  renderConflictHeatmapBar(solver, queryNorm);
  renderFlTesterPanel(solver, queryNorm);
  renderChartConflictFeed(solver, queryNorm, activeNowConflicts);

  // Snapshot List
  if (blipsLayer) blipsLayer.innerHTML = "";
  listEl.innerHTML = "";

  if (allItems.length === 0) {
    listEl.innerHTML = `<div class="snapshot-item" style="color:var(--text-muted)">Add aircraft in the Calculator tab to visualize them in 3D and test Flight Levels.</div>`;
    return;
  }

  const visibleBlips = [];

  allItems.forEach((item) => {
    const st = getAircraftStateAtTime(item, solver, queryNorm);
    const wptLabel = getAcftCorridorShort(item);

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
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="snapshot-top">
        <span class="callsign-cell">${item.acft.callsign}</span>
        <span class="badge ${badgeClass}">${wptLabel} • ${st.altStr}</span>
      </div>
      <div class="snapshot-status" style="color: ${st.color}">${st.text}</div>
    `;
    row.addEventListener("click", () => {
      state.selectedTestAcftId = item.acft.id;
      renderRadarChartView(solver);
    });
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

  if (blipsLayer && state.chartMode === "2d") {
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
}

// Wire up 3D Touch/Mouse Orbit, Pinch Zoom, and Tap-to-Select Plane
function setup3dCanvasInteractions() {
  const canvas = document.getElementById("radar3dCanvas");
  if (!canvas) return;

  const activePointers = new Map();
  let lastPinchDist = null;
  let dragStartPos = null;
  let hasDragged = false;

  function redrawOnly3d() {
    const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
    renderRadarChartOnlyVisuals(solver);
  }

  function pickAirplaneAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    let bestId = null;
    let bestDist = 34; // Generous 34px mobile finger tap radius!

    (state.projectedBlips3d || []).forEach((b) => {
      const distBlip = Math.hypot(cx - b.sx, cy - b.sy);
      const insideTag =
        cx >= b.tx - 6 && cx <= b.tx + b.tw + 6 && cy >= b.ty - 6 && cy <= b.ty + b.th + 6;
      const eff = insideTag ? Math.min(distBlip, 12) : distBlip;
      if (eff < bestDist) {
        bestDist = eff;
        bestId = b.id;
      }
    });

    if (bestId !== null) {
      state.selectedTestAcftId = bestId;
      const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderRadarChartView(solver);
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 1) {
      dragStartPos = { x: e.clientX, y: e.clientY };
      hasDragged = false;
      lastPinchDist = null;
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      hasDragged = true;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const prev = activePointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      if (
        dragStartPos &&
        Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y) > 6
      ) {
        hasDragged = true;
      }
      if (hasDragged) {
        state.cam.yawDeg = (state.cam.yawDeg - dx * 0.42 + 360) % 360;
        state.cam.pitchDeg = Math.max(8, Math.min(89.5, state.cam.pitchDeg + dy * 0.35));
        document.querySelectorAll(".cam-btn[data-cam]").forEach((b) => b.classList.remove("active"));
        redrawOnly3d();
      }
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist && dist > 10) {
        const factor = dist / lastPinchDist;
        state.cam.zoom = Math.max(0.5, Math.min(3.2, state.cam.zoom * factor));
        redrawOnly3d();
      }
      lastPinchDist = dist;
    }
  });

  const endPointer = (e) => {
    const wasSingleTap = activePointers.size === 1 && !hasDragged;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) lastPinchDist = null;
    if (wasSingleTap) {
      pickAirplaneAt(e.clientX, e.clientY);
    }
  };

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      state.cam.zoom = Math.max(0.5, Math.min(3.2, state.cam.zoom * factor));
      redrawOnly3d();
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    if (state.activeView === "chart" && state.chartMode === "3d") {
      redrawOnly3d();
    }
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

      if (targetView === "chart" && state.aircraftList.length > 0) {
        const solver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
        const pCur = parseTimeInput(state.lookupTimeRaw);
        const curNorm = normalizeTime(pCur.totalMinutes, pCur.hasHour, solver.refHour);
        if (curNorm < solver.tMin - 0.5 || curNorm > solver.tMax + 0.5) {
          const initialT = Math.min(solver.tMax, solver.tMin + 5);
          const disp = denormalizeTime(initialT, solver.useHasHour, solver.refHour);
          state.lookupTimeRaw = solver.useHasHour
            ? formatTime(disp, true)
            : String(+disp.toFixed(1));
          const lookupInp = document.getElementById("lookupTimeInput");
          if (lookupInp) lookupInp.value = state.lookupTimeRaw;
        }
        requestAnimationFrame(() => renderScenarioBoard());
        return;
      }
      renderScenarioBoard();
    });
  });

  // 3D Chart Mode, Camera Presets, Z-Scale & Live Tester Event Listeners
  setup3dCanvasInteractions();

  const btnMode3d = document.getElementById("btnMode3d");
  const btnMode2d = document.getElementById("btnMode2d");
  if (btnMode3d && btnMode2d) {
    btnMode3d.addEventListener("click", () => {
      state.chartMode = "3d";
      btnMode3d.classList.add("active");
      btnMode2d.classList.remove("active");
      requestAnimationFrame(() =>
        renderRadarChartView(analyzeScenarioConflicts(state.aircraftList, state.activeRwy))
      );
    });
    btnMode2d.addEventListener("click", () => {
      state.chartMode = "2d";
      btnMode2d.classList.add("active");
      btnMode3d.classList.remove("active");
      renderRadarChartView(analyzeScenarioConflicts(state.aircraftList, state.activeRwy));
    });
  }

  document.querySelectorAll(".cam-btn[data-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-cam");
      document.querySelectorAll(".cam-btn[data-cam]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (preset === "iso") {
        state.cam.yawDeg = 28;
        state.cam.pitchDeg = 34;
        state.cam.zoom = 1.0;
      } else if (preset === "top") {
        state.cam.yawDeg = 0;
        state.cam.pitchDeg = 89.5;
        state.cam.zoom = 1.05;
      } else if (preset === "side") {
        state.cam.yawDeg = 12;
        state.cam.pitchDeg = 13;
        state.cam.zoom = 1.08;
      }
      state.cam.panX = 0;
      state.cam.panY = 0;
      saveState();
      renderRadarChartOnlyVisuals(analyzeScenarioConflicts(state.aircraftList, state.activeRwy));
    });
  });

  const btnResetCam = document.getElementById("btnResetCam");
  if (btnResetCam) {
    btnResetCam.addEventListener("click", () => {
      state.cam = { ...state.cam, yawDeg: 28, pitchDeg: 34, zoom: 1.0, panX: 0, panY: 0 };
      document.querySelectorAll(".cam-btn[data-cam]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-cam") === "iso");
      });
      saveState();
      renderRadarChartOnlyVisuals(analyzeScenarioConflicts(state.aircraftList, state.activeRwy));
    });
  }

  document.querySelectorAll(".zscale-btn[data-zscale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cam.altScale = parseFloat(btn.getAttribute("data-zscale")) || 1.0;
      document.querySelectorAll(".zscale-btn").forEach((b) => b.classList.toggle("active", b === btn));
      saveState();
      renderRadarChartOnlyVisuals(analyzeScenarioConflicts(state.aircraftList, state.activeRwy));
    });
  });

  const btnResetAllTestFl = document.getElementById("btnResetAllTestFl");
  if (btnResetAllTestFl) {
    btnResetAllTestFl.addEventListener("click", () => {
      state.aircraftList.forEach((a) => {
        a.flMode = "auto";
        a.testFl = a.fl;
        a.stepTimeRaw = "";
        a.stepFl = null;
      });
      saveState();
      const newSolver = analyzeScenarioConflicts(state.aircraftList, state.activeRwy);
      renderConflictPanels(newSolver);
      renderRadarChartView(newSolver);
    });
  }

  const btnScopeAll = document.getElementById("btnScopeAll");
  const btnScopeNow = document.getElementById("btnScopeNow");
  if (btnScopeAll && btnScopeNow) {
    btnScopeAll.addEventListener("click", () => {
      state.conflictScope = "all";
      btnScopeAll.classList.add("active");
      btnScopeNow.classList.remove("active");
      renderRadarChartOnlyVisuals(analyzeScenarioConflicts(state.aircraftList, state.activeRwy));
    });
    btnScopeNow.addEventListener("click", () => {
      state.conflictScope = "now";
      btnScopeNow.classList.add("active");
      btnScopeAll.classList.remove("active");
      renderRadarChartOnlyVisuals(analyzeScenarioConflicts(state.aircraftList, state.activeRwy));
    });
  }

  const liveConflictBadge = document.getElementById("liveConflictBadge");
  if (liveConflictBadge) {
    liveConflictBadge.addEventListener("click", () => {
      const feed = document.getElementById("chartConflictFeed");
      if (feed) feed.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

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
      const initFl = Number(inputFl.value) || state.selectedFl || 150;
      state.aircraftList.push({
        id: state.nextId++,
        type: "TRN",
        callsign,
        wptId: endpoints.entryWptId,
        entryWptId: endpoints.entryWptId,
        exitWptId: endpoints.exitWptId,
        route: [endpoints.entryWptId, "AYT", endpoints.exitWptId],
        fl: initFl,
        flMode: "auto",
        testFl: initFl,
        stepTimeRaw: "",
        stepFl: null,
        dist: Number(inputDist.value) || 60,
        timeRaw: inputTime.value.trim() || "00",
        queryDme: state.globalQueryDme,
        holdMins: 0,
      });
    } else {
      const initFl = Number(inputFl.value) || state.selectedFl || 250;
      state.aircraftList.push({
        id: state.nextId++,
        type: state.flightType,
        callsign,
        wptId: state.selectedWpt,
        fl: initFl,
        flMode: "auto",
        testFl: initFl,
        stepTimeRaw: "",
        stepFl: null,
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

  // ==========================================================================
  // SCENARIO JSON IMPORTER & GEMINI SKILL HELPER CONTROLS
  // ==========================================================================
  const btnOpenJsonImporter = document.getElementById("btnOpenJsonImporter");
  const jsonImporterPanel = document.getElementById("jsonImporterPanel");
  const btnCloseJsonImporter = document.getElementById("btnCloseJsonImporter");
  const jsonImportTextarea = document.getElementById("jsonImportTextarea");
  const jsonImportFeedback = document.getElementById("jsonImportFeedback");
  const btnPasteAndImport = document.getElementById("btnPasteAndImport");
  const btnLoadBoardExample = document.getElementById("btnLoadBoardExample");
  const btnExportCurrentJson = document.getElementById("btnExportCurrentJson");
  const jsonFileInput = document.getElementById("jsonFileInput");
  const btnCopyGeminiPrompt = document.getElementById("btnCopyGeminiPrompt");
  const btnImportAppend = document.getElementById("btnImportAppend");
  const btnImportReplace = document.getElementById("btnImportReplace");

  function showJsonFeedback(message, isSuccess = true) {
    if (!jsonImportFeedback) return;
    jsonImportFeedback.className = `json-import-feedback ${isSuccess ? "success" : "error"}`;
    jsonImportFeedback.innerHTML = message;
    jsonImportFeedback.classList.remove("hidden");
  }

  function applyScenarioJson(rawText, mode = "replace") {
    try {
      const result = parseScenarioJsonText(rawText);
      if (result.rwy) {
        state.activeRwy = result.rwy;
      }

      if (mode === "replace") {
        state.aircraftList = [];
        state.nextId = 1;
      }

      const addedItems = result.aircraft.map((item) => ({
        ...item,
        id: state.nextId++,
        flMode: "auto",
        testFl: item.fl,
        stepTimeRaw: "",
        stepFl: null,
        queryDme: state.globalQueryDme,
      }));

      state.aircraftList.push(...addedItems);
      saveState();
      updateRwyUI();

      const arrCount = addedItems.filter((a) => a.type === "ARR").length;
      const depCount = addedItems.filter((a) => a.type === "DEP").length;
      const trnCount = addedItems.filter((a) => a.type === "TRN").length;
      const label = result.scenarioName ? ` (<strong>${result.scenarioName}</strong>)` : "";

      showJsonFeedback(
        `✅ Successfully ${mode === "replace" ? "imported" : "appended"} <strong>${
          addedItems.length
        } aircraft</strong>${label}: ${arrCount} ARR, ${depCount} DEP, ${trnCount} TRN.`,
        true
      );
    } catch (err) {
      showJsonFeedback(`❌ ${err.message}`, false);
    }
  }

  if (btnOpenJsonImporter && jsonImporterPanel) {
    btnOpenJsonImporter.addEventListener("click", () => {
      const isHidden = jsonImporterPanel.classList.contains("hidden");
      jsonImporterPanel.classList.toggle("hidden", !isHidden);
      if (isHidden && jsonImportTextarea) {
        jsonImportTextarea.focus();
      }
    });
  }

  if (btnCloseJsonImporter && jsonImporterPanel) {
    btnCloseJsonImporter.addEventListener("click", () => {
      jsonImporterPanel.classList.add("hidden");
    });
  }

  if (btnPasteAndImport) {
    btnPasteAndImport.addEventListener("click", async () => {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          jsonImportTextarea.value = clipText.trim();
          applyScenarioJson(clipText, "replace");
        } else if (jsonImportTextarea && jsonImportTextarea.value.trim()) {
          applyScenarioJson(jsonImportTextarea.value, "replace");
        } else {
          showJsonFeedback("Clipboard is empty. Paste your JSON into the text box below.", false);
        }
      } catch (_err) {
        if (jsonImportTextarea && jsonImportTextarea.value.trim()) {
          applyScenarioJson(jsonImportTextarea.value, "replace");
        } else {
          showJsonFeedback(
            "Browser blocked automatic clipboard read. Press Ctrl+V inside the JSON box below, then click Import.",
            false
          );
        }
      }
    });
  }

  if (btnLoadBoardExample) {
    btnLoadBoardExample.addEventListener("click", () => {
      const pretty = JSON.stringify(PR6_BOARD_EXAMPLE, null, 2);
      if (jsonImportTextarea) jsonImportTextarea.value = pretty;
      applyScenarioJson(pretty, "replace");
    });
  }

  if (btnExportCurrentJson) {
    btnExportCurrentJson.addEventListener("click", () => {
      const exportPayload = {
        scenario: "AYT TMA Custom Scenario",
        rwy: state.activeRwy,
        aircraft: state.aircraftList.map((a) => {
          if (a.type === "TRN") {
            return {
              type: "TRN",
              callsign: a.callsign,
              fl: a.fl,
              time: a.timeRaw,
              route: [a.entryWptId || a.wptId, "AYT", a.exitWptId || "DERYA"],
              dist: a.dist,
            };
          }
          if (a.type === "DEP") {
            return {
              type: "DEP",
              callsign: a.callsign,
              fl: a.fl,
              time: a.timeRaw,
              wpt: a.wptId,
            };
          }
          return {
            type: "ARR",
            callsign: a.callsign,
            fl: a.fl,
            time: a.timeRaw,
            wpt: a.wptId,
            dist: a.dist,
          };
        }),
      };
      const pretty = JSON.stringify(exportPayload, null, 2);
      if (jsonImportTextarea) jsonImportTextarea.value = pretty;
      showJsonFeedback(
        `📤 Exported <strong>${state.aircraftList.length} aircraft</strong> to the JSON box below.`,
        true
      );
    });
  }

  if (jsonFileInput) {
    jsonFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        if (jsonImportTextarea) jsonImportTextarea.value = text;
        applyScenarioJson(text, "replace");
      };
      reader.readAsText(file);
      jsonFileInput.value = "";
    });
  }

  if (btnCopyGeminiPrompt) {
    btnCopyGeminiPrompt.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(GEMINI_SKILL_PROMPT);
        showJsonFeedback(
          "🤖 Copied the <strong>Gemini Skill / Gem System Prompt</strong> to your clipboard! Paste it into your Gemini Gem instructions.",
          true
        );
      } catch (_err) {
        if (jsonImportTextarea) jsonImportTextarea.value = GEMINI_SKILL_PROMPT;
        showJsonFeedback(
          "🤖 Placed the <strong>Gemini Skill System Prompt</strong> into the box below so you can copy it.",
          true
        );
      }
    });
  }

  if (btnImportReplace) {
    btnImportReplace.addEventListener("click", () => {
      applyScenarioJson(jsonImportTextarea ? jsonImportTextarea.value : "", "replace");
    });
  }

  if (btnImportAppend) {
    btnImportAppend.addEventListener("click", () => {
      applyScenarioJson(jsonImportTextarea ? jsonImportTextarea.value : "", "append");
    });
  }

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
      lookupTimeInput.value = formatTime(disp, false);
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
      setRadarTimeFromMinutes(Math.max(0, +(norm + step).toFixed(2)));
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
