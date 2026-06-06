import { useState } from "react";
import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";

// ── Proyección geográfica ──────────────────────────────────────────────────
// Colombia: lat [−4.2, 12.5]  lng [−79.0, −66.8]
const W = 400, H = 490;
const LNG_MIN = -79.0, LNG_MAX = -66.8;
const LAT_MAX = 12.5,  LAT_MIN = -4.2;

const geo = (lat, lng) => ({
  x: ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W,
  y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H,
});

// ── Path Colombia (trazado con coordenadas geográficas reales) ────────────
//  Sentido horario desde la Punta Gallinas (La Guajira, punto más norte)
const pts = [
  // Punta Gallinas / La Guajira
  [12.45, -71.67],
  // Costa Caribe — Riohacha → Santa Marta
  [12.1,  -72.2 ],
  [11.55, -72.9 ],
  [11.26, -74.2 ],
  // Barranquilla
  [11.0,  -74.85],
  // Cartagena
  [10.39, -75.51],
  // Golfo de Morrosquillo
  [9.47,  -75.82],
  [8.8,   -76.28],
  // Golfo de Urabá
  [8.1,   -76.88],
  [7.82,  -77.12],
  // Frontera Panamá
  [7.22,  -77.38],
  [7.05,  -77.18],
  // Costa Pacífica — bajando hacia el sur
  [6.5,   -77.52],
  [5.8,   -77.48],
  [5.0,   -77.4 ],
  [4.0,   -77.32],
  [3.2,   -77.48],
  [2.5,   -78.0 ],
  [1.6,   -78.62],
  [1.25,  -78.8 ],
  // Frontera Ecuador
  [1.0,   -78.62],
  [0.6,   -78.1 ],
  [0.02,  -76.52],
  [-0.28, -75.52],
  // Frontera Perú
  [-0.5,  -75.3 ],
  [-1.0,  -74.0 ],
  [-2.0,  -72.0 ],
  [-3.0,  -70.5 ],
  // Leticia — punto más sur
  [-4.18, -69.95],
  // Frontera Brasil — subiendo al norte
  [-3.5,  -69.9 ],
  [-2.5,  -69.92],
  [-1.2,  -69.95],
  [-0.2,  -70.02],
  [1.0,   -69.5 ],
  [2.0,   -67.05],
  [2.5,   -67.02],
  // Frontera Venezuela — subiendo hacia La Guajira
  [4.0,   -67.2 ],
  [5.5,   -67.4 ],
  [6.0,   -67.45],
  [7.0,   -67.52],
  // Viraje hacia el NO — Arauca/Cúcuta
  [7.5,   -72.05],
  [8.0,   -72.28],
  [9.0,   -72.52],
  [10.0,  -72.52],
  [11.0,  -72.28],
  // Serranía de Perijá / borde Guajira
  [11.55, -71.8 ],
  [12.05, -71.75],
  [12.45, -71.67], // cierre
];

const pathD = pts.map(([lat, lng], i) => {
  const { x, y } = geo(lat, lng);
  return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ") + " Z";

// ── Ciudades ───────────────────────────────────────────────────────────────
const CIUDADES_DEF = {
  "Bogotá":       { lat: 4.711,   lng: -74.072 },
  "Medellín":     { lat: 6.244,   lng: -75.581 },
  "Cali":         { lat: 3.451,   lng: -76.532 },
  "Barranquilla": { lat: 10.968,  lng: -74.781 },
  "Bucaramanga":  { lat: 7.119,   lng: -73.122 },
  "Pereira":      { lat: 4.813,   lng: -75.696 },
  "Cartagena":    { lat: 10.391,  lng: -75.481 },
};

// Tooltip flotante
function Tooltip({ ciudad, gmv, participacion, fmt, pos }) {
  return (
    <foreignObject x={pos.x + 14} y={pos.y - 20} width={190} height={95} style={{ overflow: "visible" }}>
      <div style={{
        background: "#fff",
        border: "1.5px solid #e9d5ff",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.13)",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}>
        <p style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 4 }}>📍 {ciudad}</p>
        <p style={{ color: "#374151" }}>GMV: <strong>{fmt(gmv)}</strong></p>
        <p style={{ color: "#6b7280" }}>Participación: <strong>{participacion.toFixed(1)}%</strong></p>
        <div style={{ marginTop: 5, height: 5, background: "#f3e8ff", borderRadius: 99 }}>
          <div style={{ width: `${Math.min(participacion * 3, 100)}%`, height: "100%", background: "#8B2FC9", borderRadius: 99 }} />
        </div>
      </div>
    </foreignObject>
  );
}

export default function MapaCiudades({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);
  const [hover, setHover] = useState(null);

  const maxGmv = Math.max(...data.facturacionCiudad.map((c) => c.gmv));

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-4">Facturación por Ciudad</h2>

      <div className="flex flex-wrap gap-6 items-start justify-center">
        {/* Mapa SVG */}
        <div style={{ position: "relative" }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W} height={H}
            className="max-w-full"
            style={{ filter: "drop-shadow(0 2px 8px rgba(139,47,201,0.10))" }}
          >
            {/* Departamentos / sombra base */}
            <path d={pathD} fill="#ede9fe" stroke="#7c3aed" strokeWidth={1.8} strokeLinejoin="round" />

            {/* Gradiente interior */}
            <defs>
              <radialGradient id="mapGrad" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#f3e8ff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ddd6fe" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d={pathD} fill="url(#mapGrad)" />

            {/* Ciudades */}
            {data.facturacionCiudad.map((c) => {
              const def = CIUDADES_DEF[c.ciudad];
              if (!def) return null;
              const { x, y } = geo(def.lat, def.lng);
              const r = 7 + (c.gmv / maxGmv) * 26;
              const isHover = hover === c.ciudad;

              return (
                <g
                  key={c.ciudad}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(c.ciudad)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* Anillo exterior pulsante */}
                  <circle cx={x} cy={y} r={r + 4} fill="#8B2FC9" opacity={isHover ? 0.18 : 0.10}
                    style={{ transition: "opacity 0.2s" }} />
                  {/* Burbuja proporcional */}
                  <circle cx={x} cy={y} r={r} fill="#8B2FC9"
                    opacity={isHover ? 0.82 : 0.52}
                    style={{ transition: "all 0.2s" }} />
                  {/* Núcleo */}
                  <circle cx={x} cy={y} r={r * 0.42} fill="#E040FB" opacity={0.9} />

                  {/* Etiqueta ciudad */}
                  <text
                    x={x} y={y - r - 5}
                    textAnchor="middle" fontSize={isHover ? 11 : 10}
                    fontWeight="700" fill="#5b21b6"
                    style={{ transition: "font-size 0.15s", pointerEvents: "none" }}
                  >
                    {c.ciudad}
                  </text>

                  {/* Tooltip SVG al hacer hover */}
                  {isHover && (
                    <Tooltip
                      ciudad={c.ciudad}
                      gmv={c.gmv}
                      participacion={c.participacion}
                      fmt={M}
                      pos={{ x: x < W / 2 ? x : x - 205, y }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Panel lateral */}
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Ranking por Ciudad</h3>
          <div className="space-y-3">
            {[...data.facturacionCiudad]
              .sort((a, b) => b.gmv - a.gmv)
              .map((c, i) => (
                <div
                  key={c.ciudad}
                  className={`rounded-xl p-3 border transition cursor-pointer ${
                    hover === c.ciudad
                      ? "bg-purple-50 border-purple-300 shadow-sm"
                      : "bg-white border-gray-100 hover:bg-purple-50"
                  }`}
                  onMouseEnter={() => setHover(c.ciudad)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-purple-700">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {c.ciudad}
                    </span>
                    <span className="text-xs font-bold text-gray-500">{c.participacion.toFixed(1)}%</span>
                  </div>
                  <p className="text-base font-bold text-purple-900">{M(c.gmv)}</p>
                  <div className="mt-1.5 h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${c.participacion}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
