import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// 스타링크 탑재 기체 목록. 기체가 추가되면 여기에만 넣으면 된다.
const FLEET = {
  "HL8208": ["대한항공", "B777-300ER"], "HL8209": ["대한항공", "B777-300ER"],
  "HL8210": ["대한항공", "B777-300ER"], "HL8216": ["대한항공", "B777-300ER"],
  "HL7578": ["아시아나항공", "A350-941"], "HL7579": ["아시아나항공", "A350-941"],
  "HL7771": ["아시아나항공", "A350-941"], "HL8078": ["아시아나항공", "A350-941"],
  "HL8079": ["아시아나항공", "A350-941"], "HL8308": ["아시아나항공", "A350-941"],
  "HL8359": ["아시아나항공", "A350-941"], "HL8360": ["아시아나항공", "A350-941"],
  "HL8361": ["아시아나항공", "A350-941"], "HL8362": ["아시아나항공", "A350-941"],
  "HL8381": ["아시아나항공", "A350-941"], "HL8382": ["아시아나항공", "A350-941"],
  "HL8383": ["아시아나항공", "A350-941"], "HL8521": ["아시아나항공", "A350-941"],
  "HL8522": ["아시아나항공", "A350-941"], "HL7740": ["아시아나항공", "A330-323"],
  "HL7741": ["아시아나항공", "A330-323"], "HL7746": ["아시아나항공", "A330-323"],
};

const UBIKAIS = "https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/selectDep.fois";
const AIRLINES = { KAL: "KE", AAR: "OZ" };

// 화면 표시용 ICAO → IATA. 없는 공항은 ICAO 코드 그대로 표시된다.
const IATA = {
  CYVR: "YVR", CYYZ: "YYZ", EDDF: "FRA", EGLL: "LHR", EHAM: "AMS", ENGM: "OSL", KATL: "ATL", KBOS: "BOS",
  KDFW: "DFW", KIAD: "IAD", KJFK: "JFK", KLAS: "LAS", KLAX: "LAX", KORD: "ORD", KSEA: "SEA", KSFO: "SFO",
  LEBL: "BCN", LEMD: "MAD", LFPG: "CDG", LHBP: "BUD", LIMC: "MXP", LIRF: "FCO", LKPR: "PRG", LOWW: "VIE",
  LPPT: "LIS", LSZH: "ZRH", LTFM: "IST", MMGL: "GDL", NZAA: "AKL", PGUM: "GUM", PHNL: "HNL", RCTP: "TPE",
  RJAA: "NRT", RJBB: "KIX", RJCC: "CTS", RJFF: "FUK", RJGG: "NGO", RJTT: "HND", RKJJ: "KWJ", RKJY: "RSU",
  RKPC: "CJU", RKPK: "PUS", RKPU: "USN", RKSI: "ICN", RKSS: "GMP", RKTN: "TAE", RKTU: "CJJ", ROAH: "OKA",
  RPLC: "CRK", RPLL: "MNL", RPVM: "CEB", SBKP: "VCP", UAAA: "ALA", UZTT: "TAS", VDTI: "TCE", VHHH: "HKG",
  VIDP: "DEL", VMMC: "MFM", VNKT: "KTM", VTBS: "BKK", VTSP: "HKT", VVCR: "CXR", VVDN: "DAD", VVNB: "HAN",
  VVPQ: "PQC", VVTS: "SGN", VYYY: "RGN", WADD: "DPS", WIII: "CGK", WMKK: "KUL", WSSS: "SIN", YBBN: "BNE",
  YSSY: "SYD", ZBAA: "PEK", ZBTJ: "TSN", ZGGG: "CAN", ZGSZ: "SZX", ZSPD: "PVG", ZSQD: "TAO", ZSSS: "SHA",
  ZYTL: "DLC", ZYYJ: "YNJ",
};
const ap = (c) => IATA[c] || c || "?";
const fltNo = (fpId) => (fpId && AIRLINES[fpId.slice(0, 3)] ? AIRLINES[fpId.slice(0, 3)] + fpId.slice(3) : fpId || "-");

// ---- KST 시간 계산 ----
// UBIKAIS: schTime/sta 는 각 공항 현지시각, etd/atd/eta/ata 는 KST(HHMM).
const H = 3600e3, DAY = 24 * H, KST = 9 * H;
const kstMs = (yyyymmdd, hhmm) => Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8),
  +hhmm.slice(0, 2), +hhmm.slice(2, 4)) - KST;
const sameDay = (ref, hhmm) => {
  const d = new Date(ref + KST);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +hhmm.slice(0, 2), +hhmm.slice(2, 4)) - KST;
};
const nearest = (ref, hhmm) => { let t = sameDay(ref, hhmm); if (t - ref > DAY / 2) t -= DAY; if (ref - t > DAY / 2) t += DAY; return t; };
const before = (ref, hhmm) => { let t = sameDay(ref, hhmm); if (t > ref) t -= DAY; return t; };
const after = (ref, hhmm) => { let t = sameDay(ref, hhmm); if (t < ref) t += DAY; return t; };
const ymd = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
const fmt = (ms) => {
  const d = new Date(ms + KST);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}월 ${String(d.getUTCDate()).padStart(2, "0")}일 ${d.toISOString().slice(11, 16)} KST`;
};
const hm = (ms) => new Date(ms + KST).toISOString().slice(11, 16);

// 레코드 하나를 출발/도착 KST 시각으로 정규화
function normalize(r, now) {
  if (r.depStatus === "CNL") return null;
  const outbound = (r.apIcao || "").startsWith("RK");
  let dep, arr = null, departed;
  if (outbound) {
    dep = nearest(kstMs(r.schDate, r.schTime), r.atd || r.etd || r.schTime);
    if (r.ata || r.eta) arr = after(dep, r.ata || r.eta);
    departed = !!(r.atd || r.ata);
  } else {
    if (!r.sta) return null;
    arr = nearest(kstMs(r.staDate || r.schDate, r.sta), r.ata || r.eta || r.sta);
    dep = r.atd || r.etd ? before(arr, r.atd || r.etd) : arr - 12 * H;
    departed = !!(r.atd || r.ata) || dep <= now;
  }
  return {
    flightNo: fltNo(r.fpId), orig: r.apIcao, dest: r.apArr, dep, arr, departed,
    arrived: !!r.ata, fpl: r.fplYn === "Y", status: r.depStatus,
  };
}

async function fetchDay(date, al) {
  const qs = new URLSearchParams({ downloadYn: 1, srchDate: date, srchDatesh: date.replace(/-/g, ""), srchAl: al, srchFln: "", srchDep: "", srchArr: "" });
  const res = await fetch(`${UBIKAIS}?${qs}`, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
  if (!res.ok) throw new Error(`UBIKAIS HTTP ${res.status}`);
  const j = await res.json();
  if (j.status !== "success") throw new Error(`UBIKAIS ${j.status}`);
  return j.records || [];
}

// node scripts/fleet.mjs <출력 경로>
const out = process.argv[2] || "fleet.json";
const now = Date.now();
// 어제·오늘·내일 목록 (자정을 넘는 장거리편, 새벽 출발편 대비)
const dates = [-1, 0, 1].map((o) => ymd(now + o * DAY));
const records = (await Promise.all(dates.flatMap((d) => Object.keys(AIRLINES).map((al) => fetchDay(d, al))))).flat();

const byReg = {};
const seenPk = new Set();
for (const r of records) {
  if (!FLEET[r.acId] || seenPk.has(r.flightPk)) continue;
  seenPk.add(r.flightPk);
  const f = normalize(r, now);
  if (f) (byReg[r.acId] ||= []).push(f);
}

const airborne = [], ground = [];
for (const [reg, [airline, model]] of Object.entries(FLEET)) {
  const legs = (byReg[reg] || []).sort((a, b) => a.dep - b.dep);
  const cur = legs.filter((l) => l.departed && l.dep <= now).at(-1);
  const next = legs.find((l) => !l.departed && l.dep > now - 3 * H);

  const flying = cur && !cur.arrived && (cur.arr ? now < cur.arr + H : now - cur.dep < 16 * H);
  if (flying) {
    airborne.push({
      reg, airline, model, flightNo: cur.flightNo, orig: ap(cur.orig), dest: ap(cur.dest),
      statusText: `출발 ${hm(cur.dep)}` + (cur.arr ? ` · 도착예정 ${hm(cur.arr)}` : ""),
    });
    continue;
  }

  const parked = cur ? cur.dest : next?.orig;
  ground.push({
    reg, airline, model,
    parkedCode: parked ? ap(parked) : "확인 불가",
    parkedName: parked || "UBIKAIS 최근 3일 기록 없음",
    arrivalTime: cur ? (cur.arr ? fmt(cur.arr) : "시간 미상") : "-",
    lastFlight: cur ? `${cur.flightNo}편 (${ap(cur.orig)} ➡️ ${ap(cur.dest)})` : "-",
    nextFlight: next ? `${next.flightNo} ➡️ ${ap(next.dest)} (${hm(next.dep)} 출발)` : "비행계획 없음 (배정 대기)",
    hasScheduledPlan: !!next,
    fplApproved: !!next?.fpl,
    sortKey: next ? next.dep : Infinity,
  });
}
// FPL 승인된 다음 편 → 스케줄만 있는 편 → 계획 없음, 각각 출발 빠른 순
ground.sort((a, b) => b.fplApproved - a.fplApproved || b.hasScheduledPlan - a.hasScheduledPlan || a.sortKey - b.sortKey);
ground.forEach((g) => delete g.sortKey);


const data = { updatedAt: now, updatedKst: fmt(now), airborne, ground };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data));
console.log(`${data.updatedKst} 운항 ${airborne.length} / 계류 ${ground.length} → ${out}`);
