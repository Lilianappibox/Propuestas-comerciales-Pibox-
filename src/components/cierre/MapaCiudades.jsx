import { useState } from "react";
import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";

// ── Proyección geográfica ──────────────────────────────────────────────────
const W = 400, H = 480;
const LNG_MIN = -79.0, LNG_MAX = -66.8;
const LAT_MAX = 12.5,  LAT_MIN = -4.2;

const geo = (lat, lng) => ({
  x: Math.round(((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W * 10) / 10,
  y: Math.round(((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H * 10) / 10,
});

// ── Path Colombia — trazado punto a punto con coordenadas reales ───────────
// Sentido horario desde Punta Gallinas (La Guajira, punto más norte)
const BORDER = [
  // ── Costa Caribe ──
  [12.45, -71.67], // Punta Gallinas
  [12.10, -72.00],
  [11.85, -72.50],
  [11.55, -72.90],
  [11.26, -74.20], // Santa Marta
  [11.00, -74.85], // Barranquilla
  [10.60, -75.30],
  [10.39, -75.51], // Cartagena
  [10.10, -75.70],
  [9.47,  -75.82], // Golfo Morrosquillo
  [8.90,  -76.25],
  [8.50,  -76.80], // Golfo de Urabá norte
  [8.10,  -76.88],
  [7.82,  -77.12], // Urabá sur
  // ── Frontera Panamá ──
  [7.22,  -77.38],
  [7.05,  -77.18],
  // ── Costa Pacífica ──
  [6.80,  -77.42],
  [6.20,  -77.52],
  [5.50,  -77.45],
  [5.00,  -77.40],
  [4.30,  -77.35],
  [3.80,  -77.48],
  [3.20,  -77.50],
  [2.60,  -77.90],
  [1.80,  -78.60],
  [1.40,  -78.75],
  [1.20,  -78.82],
  // ── Frontera Ecuador ──
  [1.00,  -78.62],
  [0.60,  -78.10],
  [0.20,  -77.20],
  [0.00,  -76.52],
  [-0.28, -75.52],
  // ── Frontera Perú ──
  [-0.50, -75.28],
  [-1.00, -74.00],
  [-1.80, -72.30],
  [-2.80, -70.80],
  [-4.00, -70.20],
  [-4.18, -69.96], // Leticia — punto más sur
  // ── Frontera Brasil (subiendo) ──
  [-3.50, -69.90],
  [-2.50, -69.92],
  [-1.50, -69.95],
  [-0.50, -70.02],
  [0.00,  -70.02],
  [0.80,  -69.80],
  [1.20,  -69.60],
  // ── Frontera Venezuela (viraje al NO) ──
  [2.00,  -67.05],
  [2.50,  -67.02],
  [3.50,  -67.18],
  [4.00,  -67.22],
  [5.00,  -67.38],
  [5.50,  -67.40],
  [6.00,  -67.45],
  [6.60,  -67.50],
  [7.00,  -67.52],
  // ── Viraje hacia el NO (Arauca / Cúcuta) ──
  [7.30,  -69.00],
  [7.50,  -70.80],
  [7.80,  -72.10],
  [8.10,  -72.28],
  [8.60,  -72.40],
  [9.00,  -72.52],
  [9.60,  -72.52],
  [10.00, -72.52],
  [10.50, -72.38],
  [11.00, -72.28],
  // ── Serranía de Perijá / vuelta a La Guajira ──
  [11.50, -71.85],
  [12.05, -71.75],
  [12.45, -71.67], // cierre
];

const pathD = BORDER.map(([lat, lng], i) => {
  const { x, y } = geo(lat, lng);
  return `${i === 0 ? "M" : "L"} ${x},${y}`;
}).join(" ") + " Z";

// ── Lookup de coordenadas para ciudades colombianas ───────────────────────
const CIUDAD_COORDS = {
  // Normalizados a minúsculas sin tildes para búsqueda flexible
  "bogota":          { lat: 4.711,  lng: -74.072 },
  "bogotá":          { lat: 4.711,  lng: -74.072 },
  "medellin":        { lat: 6.244,  lng: -75.581 },
  "medellín":        { lat: 6.244,  lng: -75.581 },
  "cali":            { lat: 3.451,  lng: -76.532 },
  "barranquilla":    { lat: 10.968, lng: -74.781 },
  "cartagena":       { lat: 10.391, lng: -75.481 },
  "bucaramanga":     { lat: 7.119,  lng: -73.122 },
  "cucuta":          { lat: 7.893,  lng: -72.507 },
  "cúcuta":          { lat: 7.893,  lng: -72.507 },
  "pereira":         { lat: 4.813,  lng: -75.696 },
  "manizales":       { lat: 5.070,  lng: -75.513 },
  "ibague":          { lat: 4.438,  lng: -75.232 },
  "ibagué":          { lat: 4.438,  lng: -75.232 },
  "villavicencio":   { lat: 4.153,  lng: -73.635 },
  "santa marta":     { lat: 11.240, lng: -74.199 },
  "pasto":           { lat: 1.214,  lng: -77.282 },
  "monteria":        { lat: 8.757,  lng: -75.881 },
  "montería":        { lat: 8.757,  lng: -75.881 },
  "valledupar":      { lat: 10.463, lng: -73.253 },
  "neiva":           { lat: 2.935,  lng: -75.282 },
  "armenia":         { lat: 4.534,  lng: -75.681 },
  "sincelejo":       { lat: 9.305,  lng: -75.398 },
  "popayan":         { lat: 2.441,  lng: -76.606 },
  "popayán":         { lat: 2.441,  lng: -76.606 },
  "tunja":           { lat: 5.535,  lng: -73.358 },
  "riohacha":        { lat: 11.545, lng: -72.907 },
  "florencia":       { lat: 1.614,  lng: -75.606 },
  "quibdo":          { lat: 5.694,  lng: -76.658 },
  "quibdó":          { lat: 5.694,  lng: -76.658 },
  "leticia":         { lat: -4.215, lng: -69.940 },
  "san andres":      { lat: 12.532, lng: -81.722 },
  "san andrés":      { lat: 12.532, lng: -81.722 },
  "yopal":           { lat: 5.338,  lng: -72.395 },
  "mocoa":           { lat: 1.152,  lng: -76.648 },
  "mitú":            { lat: 1.253,  lng: -70.233 },
  "mitu":            { lat: 1.253,  lng: -70.233 },
  "arauca":          { lat: 7.090,  lng: -70.762 },
  "inírida":         { lat: 3.865,  lng: -67.924 },
  "inirida":         { lat: 3.865,  lng: -67.924 },
  "puerto carreno":  { lat: 6.189,  lng: -67.485 },
  "puerto carreño":  { lat: 6.189,  lng: -67.485 },
  "barrancabermeja": { lat: 7.065,  lng: -73.854 },
};

/** Normaliza nombre de ciudad para buscar en el lookup */
const normCiudad = (s) =>
  String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Resuelve coordenadas: usa las del dato si existen, si no busca en lookup */
function resolverCoords(ciudad) {
  const n = normCiudad(ciudad);
  // Búsqueda exacta
  if (CIUDAD_COORDS[n]) return CIUDAD_COORDS[n];
  // Búsqueda parcial (ej: "Bogotá D.C." → bogota)
  const key = Object.keys(CIUDAD_COORDS).find((k) => n.includes(k) || k.includes(n));
  return key ? CIUDAD_COORDS[key] : null;
}

// ── Tooltip flotante SVG ───────────────────────────────────────────────────
function CityTooltip({ ciudad, gmv, participacion, fmt, x, y, mapW }) {
  const flipX = x > mapW * 0.6;
  const tx = flipX ? x - 200 : x + 14;
  const ty = Math.max(10, y - 20);
  return (
    <foreignObject x={tx} y={ty} width={192} height={100} style={{ overflow: "visible", pointerEvents: "none" }}>
      <div style={{
        background: "#fff", border: "1.5px solid #e9d5ff", borderRadius: 10,
        padding: "8px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.14)", fontSize: 12,
      }}>
        <p style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 4 }}>📍 {ciudad}</p>
        <p style={{ color: "#374151" }}>GMV: <strong>{fmt(gmv)}</strong></p>
        <p style={{ color: "#6b7280" }}>Part.: <strong>{participacion.toFixed(1)}%</strong></p>
        <div style={{ marginTop: 5, height: 5, background: "#f3e8ff", borderRadius: 99 }}>
          <div style={{ width: `${Math.min(participacion * 3, 100)}%`, height: "100%", background: "#8B2FC9", borderRadius: 99 }} />
        </div>
      </div>
    </foreignObject>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function MapaCiudades({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);
  const [hover, setHover] = useState(null);

  // Enriquece cada ciudad con coordenadas resueltas
  const ciudades = data.facturacionCiudad
    .map((c) => {
      // Si tiene lat/lng propios úsalos, si no búscalos por nombre
      const coords = (c.lat && c.lng && c.lat !== 0)
        ? { lat: c.lat, lng: c.lng }
        : resolverCoords(c.ciudad);
      if (!coords) return null; // ciudad desconocida — no mostrar en mapa
      const pt = geo(coords.lat, coords.lng);
      return { ...c, svgX: pt.x, svgY: pt.y };
    })
    .filter(Boolean);

  const maxGmv = Math.max(...ciudades.map((c) => c.gmv), 1);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-4">Facturación por Ciudad</h2>

      <div className="flex flex-wrap gap-6 items-start justify-center">

        {/* ── Mapa SVG ── */}
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W} height={H}
            className="max-w-full"
            style={{ filter: "drop-shadow(0 2px 10px rgba(139,47,201,0.12))" }}
          >
            <defs>
              <radialGradient id="colGrad" cx="45%" cy="40%" r="55%">
                <stop offset="0%"   stopColor="#f5f0ff" />
                <stop offset="100%" stopColor="#ddd6fe" />
              </radialGradient>
            </defs>

            {/* Silueta Colombia */}
            <path d={pathD} fill="url(#colGrad)" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round" />

            {/* Ciudades */}
            {ciudades.map((c) => {
              const r        = 7 + (c.gmv / maxGmv) * 25;
              const isHover  = hover === c.ciudad;
              return (
                <g
                  key={c.ciudad}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(c.ciudad)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* Halo */}
                  <circle cx={c.svgX} cy={c.svgY} r={r + 5}
                    fill="#8B2FC9" opacity={isHover ? 0.15 : 0.07}
                    style={{ transition: "opacity .2s" }} />
                  {/* Burbuja proporcional */}
                  <circle cx={c.svgX} cy={c.svgY} r={r}
                    fill="#8B2FC9" opacity={isHover ? 0.82 : 0.50}
                    style={{ transition: "all .2s" }} />
                  {/* Núcleo */}
                  <circle cx={c.svgX} cy={c.svgY} r={r * 0.40}
                    fill="#E040FB" opacity={0.9} />

                  {/* Etiqueta */}
                  <text x={c.svgX} y={c.svgY - r - 5}
                    textAnchor="middle" fontSize={isHover ? 11 : 9.5}
                    fontWeight="700" fill="#4c1d95"
                    style={{ transition: "font-size .15s", pointerEvents: "none" }}>
                    {c.ciudad}
                  </text>

                  {/* Tooltip */}
                  {isHover && (
                    <CityTooltip
                      ciudad={c.ciudad} gmv={c.gmv}
                      participacion={c.participacion} fmt={M}
                      x={c.svgX} y={c.svgY} mapW={W}
                    />
                  )}
                </g>
              );
            })}

            {/* Ciudades sin coordenadas conocidas — aviso */}
            {data.facturacionCiudad.filter((c) => !ciudades.find((x) => x.ciudad === c.ciudad)).map((c, i) => (
              <text key={c.ciudad} x={10} y={H - 20 - i * 14} fontSize={9} fill="#ef4444" opacity={0.7}>
                ⚠ {c.ciudad} (sin coordenadas)
              </text>
            ))}
          </svg>
        </div>

        {/* ── Panel lateral ── */}
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Ranking por Ciudad</h3>
          <div className="space-y-3">
            {[...data.facturacionCiudad]
              .sort((a, b) => b.gmv - a.gmv)
              .map((c, i) => (
                <div
                  key={c.ciudad}
                  className={`rounded-xl p-3 border cursor-pointer transition ${
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
