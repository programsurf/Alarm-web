// 학회 목록 설정 (카테고리/파일명)
const CONFERENCES = [
    // AI
    { sub: "AI", name: "cvpr" },
    { sub: "AI", name: "iccv" },
    { sub: "AI", name: "eccv" },
    { sub: "AI", name: "aaai" },
    { sub: "AI", name: "ijcai" },
    { sub: "AI", name: "icml" },
    { sub: "AI", name: "nips" },  // NeurIPS
    { sub: "AI", name: "iclr" },
    // Security
    { sub: "SC", name: "sp" },      // IEEE S&P
    { sub: "SC", name: "ccs" },
    { sub: "SC", name: "uss" },     // USENIX Security
    { sub: "SC", name: "ndss" },
    { sub: "SC", name: "eurocrypt" },
    { sub: "SC", name: "crypto" },
    { sub: "SC", name: "asiacrypt" },
    { sub: "SC", name: "esorics" },
    { sub: "SC", name: "dsn" },
    // Network
    { sub: "NW", name: "sigcomm" },
    { sub: "NW", name: "infocom" },
    { sub: "NW", name: "nsdi" },
    { sub: "DS", name: "sigmetrics" },
    // Data
    { sub: "DB", name: "icdm" },
    { sub: "DB", name: "bigdata" },
];

// 카테고리 매핑
const CATEGORY_MAP = {
    "AI": "AI/Vision",
    "SC": "Security",
    "NW": "Network",
    "DS": "Network",
    "DB": "Data",
    "SE": "Software",
};

// 타임존 매핑 (UTC 오프셋 -> 분 단위)
const TIMEZONE_OFFSETS = {
    "UTC-12": -720,  // AoE
    "AoE": -720,
    "UTC-11": -660,
    "UTC-10": -600,
    "UTC-9": -540,
    "UTC-8": -480,   // PST
    "UTC-7": -420,   // PDT
    "UTC-6": -360,
    "UTC-5": -300,   // EST
    "UTC-4": -240,
    "UTC-3": -180,
    "UTC-2": -120,
    "UTC-1": -60,
    "UTC": 0,
    "UTC+0": 0,
    "UTC+1": 60,
    "UTC+2": 120,
    "UTC+3": 180,
    "UTC+4": 240,
    "UTC+5": 300,
    "UTC+6": 360,
    "UTC+7": 420,
    "UTC+8": 480,    // CST (China)
    "UTC+9": 540,    // KST
    "UTC+10": 600,
    "UTC+11": 660,
    "UTC+12": 720,
};

// KST 오프셋 (분)
const KST_OFFSET = 540;
