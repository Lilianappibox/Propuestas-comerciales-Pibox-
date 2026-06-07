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
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-4">Facturación por Departamento</h2>

      <div className="flex flex-wrap gap-6 items-start justify-center">

        {/* ── Mapa SVG ── */}
        <div className="flex-shrink-0" style={{ maxWidth: 380 }}>
          <svg
            viewBox={deptData.viewBox}
            width="100%"
            style={{ maxHeight: 520, filter: "drop-shadow(0 2px 8px rgba(124,34,212,0.1))" }}
          >
            {Object.entries(departments).map(([key, pathD]) => {
              const gmv = deptGmv[key] || 0;
              const isHover = hover === key;
              const fill = getColor(gmv, maxGmv);
              return (
                <path
                  key={key}
                  d={pathD}
                  fill={isHover ? "#7C22D4" : fill}
                  stroke="#9ca3af"
                  strokeWidth={isHover ? 1.8 : 0.6}
                  opacity={isHover ? 0.9 : 1}
                  style={{ cursor: "pointer", transition: "fill 0.2s, stroke-width 0.2s" }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

            {/* Department labels for departments with data */}
            {ranking.map(({ key }) => {
              const pathD = departments[key];
              if (!pathD) return null;
              // Extract approximate center from path for label
              const coords = pathD.match(/[\d.]+/g);
              if (!coords || coords.length < 4) return null;
              const xs = [], ys = [];
              for (let i = 0; i < coords.length - 1; i += 2) {
                xs.push(parseFloat(coords[i]));
                ys.push(parseFloat(coords[i + 1]));
              }
              const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
              const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
              return (
                <text
                  key={`lbl-${key}`}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  fontSize={hover === key ? 14 : 11}
                  fontWeight="700"
                  fill={hover === key ? "#ffffff" : "#4c1d95"}
                  style={{ pointerEvents: "none", transition: "font-size 0.15s" }}
                >
                  {displayName(key).split(" ")[0]}
                </text>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-400">Menor</span>
            <div className="flex h-3 rounded-full overflow-hidden" style={{ width: 140 }}>
              {PURPLE_SCALE.map((c, i) => (
                <div key={i} style={{ flex: 1, background: c }} />
              ))}
            </div>
            <span className="text-xs text-gray-400">Mayor</span>
            <div className="flex items-center gap-1 ml-3">
              <div className="w-3 h-3 rounded" style={{ background: NO_DATA_COLOR, border: "1px solid #d1d5db" }} />
              <span className="text-xs text-gray-400">Sin datos</span>
            </div>
          </div>

          {/* Hover tooltip */}
          {hover && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm">
              <p className="font-bold text-purple-800">{displayName(hover)}</p>
              {deptGmv[hover] ? (
                <>
                  <p className="text-gray-700">GMV: <strong>{M(deptGmv[hover])}</strong></p>
                  <p className="text-gray-500">Participación: <strong>{((deptGmv[hover] / totalGmv) * 100).toFixed(1)}%</strong></p>
                  <p className="text-gray-400 text-xs mt-1">
                    Ciudades: {(deptCities[hover] || []).map((c) => c.ciudad).join(", ")}
                  </p>
                </>
              ) : (
                <p className="text-gray-400">Sin datos de facturación</p>
              )}
            </div>
          )}
        </div>

        {/* ── Ranking lateral ── */}
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Ranking por Departamento</h3>
          <div className="space-y-3">
            {ranking.map(({ key, gmv, pct }, i) => (
              <div
                key={key}
                className={`rounded-xl p-3 border cursor-pointer transition ${
                  hover === key
                    ? "bg-purple-50 border-purple-300 shadow-sm"
                    : "bg-white border-gray-100 hover:bg-purple-50"
                }`}
                onMouseEnter={() => setHover(key)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-purple-700">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {displayName(key)}
                  </span>
                  <span className="text-xs font-bold text-gray-500">{pct.toFixed(1)}%</span>
                </div>
                <p className="text-base font-bold text-purple-900">{M(gmv)}</p>
                <div className="mt-1.5 h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${(gmv / maxGmv) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {(deptCities[key] || []).map((c) => c.ciudad).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
