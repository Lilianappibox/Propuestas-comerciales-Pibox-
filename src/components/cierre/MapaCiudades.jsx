import { useState } from "react";
import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";

// ── City to Department mapping ────────────────────────────────────────────
const CITY_TO_DEPT = {
  "Bogota":        "Bogota D.C.",
  "Bogotá":        "Bogota D.C.",
  "Medellin":      "Antioquia",
  "Medellín":      "Antioquia",
  "Cali":          "Valle del Cauca",
  "Barranquilla":  "Atlantico",
  "Bucaramanga":   "Santander",
  "Pereira":       "Risaralda",
  "Cartagena":     "Bolivar",
  "Cucuta":        "Norte de Santander",
  "Cúcuta":        "Norte de Santander",
  "Manizales":     "Caldas",
  "Ibague":        "Tolima",
  "Ibagué":        "Tolima",
  "Villavicencio": "Meta",
  "Santa Marta":   "Magdalena",
  "Pasto":         "Narino",
  "Monteria":      "Cordoba",
  "Montería":      "Cordoba",
  "Valledupar":    "Cesar",
  "Neiva":         "Huila",
  "Armenia":       "Quindio",
  "Sincelejo":     "Sucre",
  "Popayan":       "Cauca",
  "Popayán":       "Cauca",
  "Tunja":         "Boyaca",
  "Riohacha":      "La Guajira",
  "Florencia":     "Caqueta",
  "Quibdo":        "Choco",
  "Quibdó":        "Choco",
};

/** Normalize city name for lookup */
const normCity = (s) =>
  String(s ?? "").trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function resolveDept(ciudad) {
  // Direct match
  if (CITY_TO_DEPT[ciudad]) return CITY_TO_DEPT[ciudad];
  // Normalized search
  const norm = normCity(ciudad);
  const key = Object.keys(CITY_TO_DEPT).find(
    (k) => normCity(k) === norm
  );
  return key ? CITY_TO_DEPT[key] : null;
}

// ── Simplified SVG paths for Colombian departments ────────────────────────
// viewBox 0 0 400 500 — approximate political boundaries
const DEPARTMENTS = [
  {
    id: "La Guajira",
    d: "M270,18 L310,10 L340,15 L345,30 L340,55 L320,70 L300,65 L280,60 L270,45 Z",
  },
  {
    id: "Atlantico",
    d: "M210,60 L240,52 L260,58 L270,65 L265,78 L248,85 L230,82 L215,75 Z",
  },
  {
    id: "Magdalena",
    d: "M260,58 L280,60 L300,65 L320,70 L310,90 L295,105 L275,110 L260,100 L248,85 L265,78 Z",
  },
  {
    id: "Cesar",
    d: "M275,110 L295,105 L310,90 L325,78 L340,85 L335,110 L320,130 L300,140 L280,135 L270,120 Z",
  },
  {
    id: "Sucre",
    d: "M175,78 L195,72 L215,75 L230,82 L235,95 L225,108 L205,112 L185,105 L175,92 Z",
  },
  {
    id: "Bolivar",
    d: "M225,108 L235,95 L248,85 L260,100 L265,115 L260,135 L250,155 L240,170 L225,168 L215,155 L210,140 L215,125 Z",
  },
  {
    id: "Cordoba",
    d: "M145,90 L165,82 L175,78 L175,92 L185,105 L205,112 L215,125 L210,140 L195,150 L175,148 L155,135 L140,118 L138,100 Z",
  },
  {
    id: "Norte de Santander",
    d: "M280,135 L300,140 L320,130 L340,125 L345,145 L335,165 L315,175 L295,170 L280,160 L275,145 Z",
  },
  {
    id: "Santander",
    d: "M240,170 L250,155 L260,135 L270,120 L280,135 L275,145 L280,160 L295,170 L290,190 L275,205 L255,210 L240,200 L235,185 Z",
  },
  {
    id: "Antioquia",
    d: "M120,125 L140,118 L155,135 L175,148 L195,150 L210,140 L215,155 L225,168 L220,185 L205,200 L185,210 L165,205 L148,195 L130,180 L115,160 L112,140 Z",
  },
  {
    id: "Boyaca",
    d: "M255,210 L275,205 L290,190 L305,195 L315,210 L310,230 L295,245 L275,248 L258,240 L248,225 Z",
  },
  {
    id: "Arauca",
    d: "M295,170 L315,175 L335,165 L360,170 L370,185 L360,200 L340,210 L315,210 L305,195 L290,190 Z",
  },
  {
    id: "Caldas",
    d: "M165,205 L185,210 L195,220 L190,235 L175,240 L160,235 L155,222 Z",
  },
  {
    id: "Risaralda",
    d: "M140,210 L155,205 L165,205 L155,222 L160,235 L148,240 L135,235 L132,220 Z",
  },
  {
    id: "Quindio",
    d: "M148,240 L160,235 L175,240 L172,255 L160,260 L148,255 Z",
  },
  {
    id: "Choco",
    d: "M65,135 L85,125 L112,140 L115,160 L120,175 L130,180 L140,210 L135,235 L125,252 L112,265 L100,275 L85,270 L72,255 L62,235 L55,210 L50,185 L55,160 Z",
  },
  {
    id: "Tolima",
    d: "M160,260 L172,255 L190,255 L205,260 L215,275 L210,295 L198,310 L180,315 L165,305 L155,290 L152,275 Z",
  },
  {
    id: "Cundinamarca",
    d: "M205,200 L220,185 L235,185 L248,225 L258,240 L250,260 L235,270 L215,275 L205,260 L190,255 L195,240 L190,235 L195,220 Z",
  },
  {
    id: "Bogota D.C.",
    d: "M225,242 L235,238 L242,248 L238,258 L228,258 L222,250 Z",
  },
  {
    id: "Valle del Cauca",
    d: "M100,275 L112,265 L125,252 L135,255 L148,255 L152,275 L155,290 L148,310 L135,320 L120,315 L108,305 L98,290 Z",
  },
  {
    id: "Casanare",
    d: "M305,195 L315,210 L340,210 L360,200 L375,210 L370,230 L350,245 L325,250 L310,230 L295,245 L275,248 L258,240 L250,260 L255,210 Z",
  },
  {
    id: "Cauca",
    d: "M98,290 L108,305 L120,315 L135,320 L148,335 L142,355 L130,370 L115,375 L100,365 L88,348 L80,325 L82,305 Z",
  },
  {
    id: "Huila",
    d: "M155,290 L165,305 L180,315 L198,310 L205,325 L200,345 L188,360 L170,365 L155,355 L145,340 L148,335 L135,320 L148,310 Z",
  },
  {
    id: "Meta",
    d: "M250,260 L275,248 L295,245 L325,250 L350,265 L365,285 L360,310 L340,335 L310,345 L280,340 L255,325 L240,305 L235,285 L235,270 Z",
  },
  {
    id: "Narino",
    d: "M68,365 L82,355 L100,365 L115,375 L120,395 L112,415 L98,425 L80,420 L65,405 L58,385 Z",
  },
  {
    id: "Caqueta",
    d: "M170,365 L188,360 L200,345 L205,325 L240,305 L255,325 L260,350 L248,375 L230,390 L210,395 L190,388 L175,378 Z",
  },
  {
    id: "Putumayo",
    d: "M112,415 L120,395 L130,380 L145,385 L170,390 L190,388 L195,405 L185,425 L168,435 L148,438 L128,432 Z",
  },
  {
    id: "Vaupes",
    d: "M260,350 L280,340 L310,345 L330,355 L340,375 L332,400 L310,410 L285,405 L265,392 L255,375 Z",
  },
  {
    id: "Guainia",
    d: "M350,265 L375,255 L395,270 L400,300 L395,330 L380,355 L360,370 L340,375 L330,355 L310,345 L340,335 L360,310 L365,285 Z",
  },
  {
    id: "Vichada",
    d: "M350,245 L370,230 L390,225 L400,240 L400,270 L395,270 L375,255 L350,265 L325,250 Z",
  },
  {
    id: "Amazonas",
    d: "M185,425 L195,405 L210,395 L230,390 L248,375 L265,392 L285,405 L310,410 L332,400 L340,420 L330,450 L310,470 L280,480 L250,485 L220,480 L195,465 L182,448 Z",
  },
  {
    id: "Guaviare",
    d: "M255,325 L280,340 L260,350 L255,375 L248,375 L230,390 L210,395 L190,388 L175,378 L170,365 L175,378 L170,365 L188,360 L200,345 L205,325 L240,305 Z",
  },
];

// ── Color scale ───────────────────────────────────────────────────────────
const PURPLE_SCALE = [
  "#ede9fe", // lightest
  "#ddd6fe",
  "#c4b5fd",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#7C22D4", // darkest
];
const NO_DATA_COLOR = "#f3f4f6";

function getColor(gmv, maxGmv) {
  if (!gmv || maxGmv === 0) return NO_DATA_COLOR;
  const ratio = gmv / maxGmv;
  const idx = Math.min(
    Math.floor(ratio * PURPLE_SCALE.length),
    PURPLE_SCALE.length - 1
  );
  return PURPLE_SCALE[idx];
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MapaCiudades({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);
  const [hover, setHover] = useState(null);

  // Build department GMV map from city data
  const deptData = {};
  (data.facturacionCiudad || []).forEach((c) => {
    const dept = resolveDept(c.ciudad);
    if (!dept) return;
    if (!deptData[dept]) {
      deptData[dept] = { gmv: 0, participacion: 0, ciudades: [] };
    }
    deptData[dept].gmv += c.gmv;
    deptData[dept].participacion += c.participacion;
    deptData[dept].ciudades.push(c.ciudad);
  });

  const maxGmv = Math.max(...Object.values(deptData).map((d) => d.gmv), 1);

  // Sorted ranking
  const ranking = Object.entries(deptData)
    .map(([dept, d]) => ({ dept, ...d }))
    .sort((a, b) => b.gmv - a.gmv);

  // Label positions (approximate centroids for departments with data)
  const LABEL_POS = {
    "Bogota D.C.":        { x: 232, y: 250 },
    "Antioquia":           { x: 158, y: 168 },
    "Valle del Cauca":     { x: 118, y: 290 },
    "Atlantico":           { x: 238, y: 68 },
    "Santander":           { x: 262, y: 180 },
    "Risaralda":           { x: 145, y: 225 },
    "Bolivar":             { x: 240, y: 135 },
    "Cordoba":             { x: 168, y: 120 },
    "Norte de Santander":  { x: 308, y: 152 },
    "Caldas":              { x: 175, y: 220 },
    "Tolima":              { x: 178, y: 285 },
    "Cundinamarca":        { x: 225, y: 245 },
    "Boyaca":              { x: 278, y: 225 },
    "Cesar":               { x: 300, y: 115 },
    "Magdalena":           { x: 280, y: 88 },
    "La Guajira":          { x: 310, y: 35 },
    "Sucre":               { x: 205, y: 92 },
    "Meta":                { x: 300, y: 295 },
    "Huila":               { x: 172, y: 340 },
    "Cauca":               { x: 112, y: 340 },
    "Narino":              { x: 90, y: 395 },
    "Caqueta":             { x: 218, y: 365 },
    "Quindio":             { x: 158, y: 248 },
    "Choco":               { x: 82, y: 205 },
  };

  return (
    <section className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-bold text-purple-800 mb-4">
        Facturacion por Departamento
      </h2>

      <div className="flex flex-wrap gap-6 items-start justify-center">
        {/* ── SVG Choropleth Map ── */}
        <div className="relative">
          <svg
            viewBox="0 0 400 500"
            width={400}
            height={500}
            className="max-w-full"
            style={{ filter: "drop-shadow(0 2px 10px rgba(124,34,212,0.10))" }}
          >
            {/* Department paths */}
            {DEPARTMENTS.map((dept) => {
              const info = deptData[dept.id];
              const fill = info ? getColor(info.gmv, maxGmv) : NO_DATA_COLOR;
              const isHovered = hover === dept.id;
              return (
                <path
                  key={dept.id}
                  d={dept.d}
                  fill={fill}
                  stroke={isHovered ? "#7C22D4" : "#9ca3af"}
                  strokeWidth={isHovered ? 2.2 : 0.8}
                  strokeLinejoin="round"
                  style={{
                    cursor: info ? "pointer" : "default",
                    transition: "fill 0.2s, stroke-width 0.2s",
                    filter: isHovered ? "brightness(0.92)" : "none",
                  }}
                  onMouseEnter={() => setHover(dept.id)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

            {/* Department labels (only for departments with data) */}
            {ranking.map(({ dept }) => {
              const pos = LABEL_POS[dept];
              if (!pos) return null;
              const isHovered = hover === dept;
              return (
                <text
                  key={`label-${dept}`}
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  fontSize={isHovered ? 9.5 : 7.5}
                  fontWeight="700"
                  fill={isHovered ? "#4c1d95" : "#374151"}
                  style={{
                    pointerEvents: "none",
                    transition: "font-size 0.15s",
                    textShadow: "0 0 3px #fff, 0 0 3px #fff",
                  }}
                >
                  {dept === "Bogota D.C." ? "Bogota" : dept.length > 12 ? dept.slice(0, 11) + "." : dept}
                </text>
              );
            })}

            {/* Tooltip */}
            {hover && deptData[hover] && (() => {
              const info = deptData[hover];
              const pos = LABEL_POS[hover] || { x: 200, y: 250 };
              const flipX = pos.x > 260;
              const flipY = pos.y > 400;
              const tx = flipX ? pos.x - 185 : pos.x + 15;
              const ty = flipY ? pos.y - 95 : pos.y - 15;
              return (
                <foreignObject
                  x={tx}
                  y={ty}
                  width={175}
                  height={95}
                  style={{ overflow: "visible", pointerEvents: "none" }}
                >
                  <div
                    style={{
                      background: "#fff",
                      border: "1.5px solid #e9d5ff",
                      borderRadius: 10,
                      padding: "8px 12px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
                      fontSize: 11,
                    }}
                  >
                    <p style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 3 }}>
                      {hover}
                    </p>
                    <p style={{ color: "#374151", margin: 0 }}>
                      GMV: <strong>{M(info.gmv)}</strong>
                    </p>
                    <p style={{ color: "#6b7280", margin: 0 }}>
                      Servicios: <strong>{Math.round(info.participacion * 100)}</strong>
                    </p>
                    <p style={{ color: "#6b7280", margin: 0 }}>
                      Part.: <strong>{info.participacion.toFixed(1)}%</strong>
                    </p>
                  </div>
                </foreignObject>
              );
            })()}
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 justify-center">
            <span className="text-xs text-gray-500">Menor</span>
            {PURPLE_SCALE.map((c, i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 10,
                  background: c,
                  borderRadius: 2,
                  border: "1px solid #e5e7eb",
                }}
              />
            ))}
            <span className="text-xs text-gray-500">Mayor</span>
            <div className="ml-3 flex items-center gap-1">
              <div
                style={{
                  width: 22,
                  height: 10,
                  background: NO_DATA_COLOR,
                  borderRadius: 2,
                  border: "1px solid #e5e7eb",
                }}
              />
              <span className="text-xs text-gray-400">Sin datos</span>
            </div>
          </div>
        </div>

        {/* ── Ranking Panel ── */}
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Ranking por Departamento
          </h3>
          <div className="space-y-3">
            {ranking.map((r, i) => (
              <div
                key={r.dept}
                className={`rounded-xl p-3 border cursor-pointer transition ${
                  hover === r.dept
                    ? "bg-purple-50 border-purple-300 shadow-sm"
                    : "bg-white border-gray-100 hover:bg-purple-50"
                }`}
                onMouseEnter={() => setHover(r.dept)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-purple-700">
                    {i + 1}. {r.dept}
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    {r.participacion.toFixed(1)}%
                  </span>
                </div>
                <p className="text-base font-bold text-purple-900">{M(r.gmv)}</p>
                <div className="mt-1.5 h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${(r.gmv / maxGmv) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {r.ciudades.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
