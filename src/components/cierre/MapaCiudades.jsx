import { useState } from "react";
import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";
import deptData from "../../data/colombiaDepts.json";

// ── City → Department mapping ─────────────────────────────────────────────
const CITY_TO_DEPT = {
  "Bogota":        "BogotáD.C.",
  "Bogotá":        "BogotáD.C.",
  "Medellin":      "Antioquia",
  "Medellín":      "Antioquia",
  "Cali":          "ValledelCauca",
  "Barranquilla":  "Atlántico",
  "Bucaramanga":   "Santander",
  "Pereira":       "Risaralda",
  "Cartagena":     "Bolívar",
  "Cucuta":        "NortedeSantander",
  "Cúcuta":        "NortedeSantander",
  "Manizales":     "Caldas",
  "Ibague":        "Tolima",
  "Ibagué":        "Tolima",
  "Villavicencio": "Meta",
  "Santa Marta":   "Magdalena",
  "Pasto":         "Nariño",
  "Monteria":      "Córdoba",
  "Montería":      "Córdoba",
  "Valledupar":    "Cesar",
  "Neiva":         "Huila",
  "Armenia":       "Quindío",
  "Sincelejo":     "Sucre",
  "Popayan":       "Cauca",
  "Popayán":       "Cauca",
  "Tunja":         "Boyacá",
  "Riohacha":      "LaGuajira",
  "Florencia":     "Caquetá",
  "Quibdo":        "Chocó",
  "Quibdó":        "Chocó",
  "Yopal":         "Casanare",
  "Mocoa":         "Putumayo",
  "Arauca":        "Arauca",
  "Leticia":       "Amazonas",
  "San Andres":    "SanAndrésyProvidencia",
  "San Andrés":    "SanAndrésyProvidencia",
  "Inirida":       "Guainía",
  "Inírida":       "Guainía",
  "San José del Guaviare": "Guaviare",
  "Mitú":          "Vaupés",
  "Mitu":          "Vaupés",
  "Puerto Carreño": "Vichada",
  "Puerto Carreno": "Vichada",
};

// ── Display names for departments ─────────────────────────────────────────
const DEPT_DISPLAY = {
  "BogotáD.C.": "Bogotá D.C.",
  "LaGuajira": "La Guajira",
  "NortedeSantander": "N. de Santander",
  "ValledelCauca": "Valle del Cauca",
  "SanAndrésyProvidencia": "San Andrés",
  "Atlántico": "Atlántico",
  "Bolívar": "Bolívar",
  "Boyacá": "Boyacá",
  "Caquetá": "Caquetá",
  "Chocó": "Chocó",
  "Córdoba": "Córdoba",
  "Guainía": "Guainía",
  "Nariño": "Nariño",
  "Quindío": "Quindío",
  "Vaupés": "Vaupés",
};

const displayName = (key) => DEPT_DISPLAY[key] || key;

// ── Purple color scale ────────────────────────────────────────────────────
const PURPLE_SCALE = ["#f5f0ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7C22D4"];
const NO_DATA_COLOR = "#f3f4f6";

function getColor(gmv, maxGmv) {
  if (!gmv || gmv === 0) return NO_DATA_COLOR;
  const ratio = gmv / maxGmv;
  const idx = Math.min(Math.floor(ratio * PURPLE_SCALE.length), PURPLE_SCALE.length - 1);
  return PURPLE_SCALE[idx];
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MapaCiudades({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);
  const [hover, setHover] = useState(null);

  // Aggregate city data into departments
  const deptGmv = {};
  const deptCities = {};
  data.facturacionCiudad.forEach((c) => {
    const deptKey = CITY_TO_DEPT[c.ciudad];
    if (!deptKey) return;
    deptGmv[deptKey] = (deptGmv[deptKey] || 0) + c.gmv;
    if (!deptCities[deptKey]) deptCities[deptKey] = [];
    deptCities[deptKey].push(c);
  });

  const maxGmv = Math.max(...Object.values(deptGmv), 1);
  const totalGmv = Object.values(deptGmv).reduce((a, b) => a + b, 0);

  // Ranking sorted by GMV
  const ranking = Object.entries(deptGmv)
    .map(([key, gmv]) => ({ key, gmv, pct: ((gmv / totalGmv) * 100) }))
    .sort((a, b) => b.gmv - a.gmv);

  // Department paths from JSON
  const departments = deptData.departments;

  return (
    <section className="bg-white rounded-2xl shadow-md px-5 pt-2 pb-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">

        {/* ── Mapa SVG ── */}
        <div className="lg:col-span-2 flex flex-col">
          <svg
            viewBox={deptData.viewBox}
            width="100%"
            preserveAspectRatio="xMidYMin meet"
            style={{ height: "calc(100vh - 90px)", maxHeight: 860, filter: "drop-shadow(0 2px 8px rgba(124,34,212,0.08))" }}
          >
            {Object.entries(departments).map(([key, pathD]) => {
              const gmv = deptGmv[key] || 0;
              const isHover = hover === key;
              return (
                <path key={key} d={pathD}
                  fill={isHover ? "#7C22D4" : getColor(gmv, maxGmv)}
                  stroke="#9ca3af" strokeWidth={isHover ? 1.8 : 0.6}
                  opacity={isHover ? 0.9 : 1}
                  style={{ cursor: "pointer", transition: "fill 0.2s" }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
            {ranking.map(({ key }) => {
              const pathD = departments[key];
              if (!pathD) return null;
              const coords = pathD.match(/[\d.]+/g);
              if (!coords || coords.length < 4) return null;
              const xs = [], ys = [];
              for (let i = 0; i < coords.length - 1; i += 2) {
                xs.push(parseFloat(coords[i])); ys.push(parseFloat(coords[i + 1]));
              }
              const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
              const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
              return (
                <text key={`lbl-${key}`} x={cx} y={cy} textAnchor="middle"
                  fontSize={hover === key ? 13 : 10} fontWeight="700"
                  fill={hover === key ? "#fff" : "#4c1d95"}
                  style={{ pointerEvents: "none" }}>
                  {displayName(key).split(" ")[0]}
                </text>
              );
            })}
          </svg>

          {/* Leyenda */}
          <div className="flex items-center gap-2 mt-1 justify-center">
            <span className="text-[10px] text-gray-400">Menor</span>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ width: 100 }}>
              {PURPLE_SCALE.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
            </div>
            <span className="text-[10px] text-gray-400">Mayor</span>
            <div className="flex items-center gap-1 ml-2">
              <div className="w-2.5 h-2.5 rounded" style={{ background: NO_DATA_COLOR, border: "1px solid #d1d5db" }} />
              <span className="text-[10px] text-gray-400">Sin datos</span>
            </div>
          </div>
        </div>

        {/* ── Panel derecho: título + detail card + ranking ── */}
        {/* paddingTop = 17.1% del alto del SVG (La Guajira empieza en y=171/1000 del viewBox) */}
        <div className="lg:col-span-1 sticky top-4 flex flex-col gap-2"
          style={{ paddingTop: "min(calc((100vh - 90px) * 0.171), 148px)" }}>
          <h2 className="text-lg font-bold text-purple-800">Facturación por Departamento</h2>

          {/* Detail card (aparece al hacer hover — dentro de la vista) */}
          <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${hover ? "border-purple-200 bg-purple-50" : "border-gray-100 bg-gray-50"}`}
            style={{ minHeight: 72 }}>
            {hover ? (
              <div className="px-3 py-2.5">
                <p className="text-sm font-extrabold text-purple-800 leading-tight">{displayName(hover)}</p>
                {deptGmv[hover] ? (
                  <>
                    <p className="text-base font-extrabold text-purple-900 mt-0.5">{M(deptGmv[hover])}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500">Participación</span>
                      <span className="text-xs font-bold text-purple-600">{((deptGmv[hover] / totalGmv) * 100).toFixed(1)}%</span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500 truncate">{(deptCities[hover] || []).map(c => c.ciudad).join(", ")}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Sin datos de facturación</p>
                )}
              </div>
            ) : (
              <p className="px-3 py-3 text-[10px] text-gray-400 italic">Pasa el cursor sobre un departamento</p>
            )}
          </div>

          {/* Ranking ultra-compacto */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Ranking</p>
            <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
              {ranking.map(({ key, gmv, pct }, i) => (
                <div key={key}
                  className={`rounded-lg px-2.5 py-1.5 cursor-pointer transition ${hover === key ? "bg-purple-100" : "hover:bg-purple-50"}`}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] font-bold text-purple-700 truncate">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {displayName(key)}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-purple-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${(gmv / maxGmv) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-purple-900 shrink-0 whitespace-nowrap">
                      {M(gmv)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
