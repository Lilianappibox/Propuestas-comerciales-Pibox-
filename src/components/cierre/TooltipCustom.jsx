import { colorCumplimiento } from "./utils";

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #e9d5ff",
  borderRadius: 12,
  padding: "10px 14px",
  minWidth: 230,
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  fontSize: 13,
};

/**
 * Tooltip genérico para barras de GMV/Meta.
 * Recibe el formateador de la moneda activa como prop `fmt`.
 *
 * Modes:
 *  "metaGmv"    → muestra Meta, GMV y % cumplimiento
 *  "comparativo"→ muestra dos valores (mes actual vs anterior) y % crecimiento
 *  "simple"     → muestra sólo el valor de cada barra
 */
export function TooltipMetaGMV({ active, payload, label, fmt, fmtFull }) {
  if (!active || !payload?.length) return null;
  const meta  = payload.find((p) => p.dataKey === "Meta")?.value  ?? 0;
  const gmvP  = payload.find((p) => p.dataKey === "GMV");
  const gmv   = gmvP?.value ?? 0;
  const cumpl = meta > 0 ? ((gmv / meta) * 100).toFixed(1) : null;
  const color = cumpl ? colorCumplimiento(Number(cumpl)) : "#6b7280";

  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 800, color: "#374151", marginBottom: 6, fontSize: 14 }}>{label}</p>

      {/* GMV destacado */}
      {gmvP && (
        <div style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>GMV Real</p>
          <p style={{ fontWeight: 800, fontSize: 16, color: gmvP.stroke || gmvP.color || "#E040FB", lineHeight: 1 }}>
            {fmtFull ? fmtFull(gmv) : fmt ? fmt(gmv) : gmv}
          </p>
        </div>
      )}

      {/* Resto del payload (Meta, Predicción, etc.) */}
      {payload.filter((p) => p.dataKey !== "GMV").map((p) => (
        <p key={p.dataKey} style={{ color: p.stroke || p.fill || p.color || "#6b7280", marginBottom: 3, fontSize: 12 }}>
          {p.name ?? p.dataKey}: <strong>{fmtFull ? fmtFull(p.value) : fmt ? fmt(p.value) : p.value}</strong>
        </p>
      ))}

      {cumpl && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f3e8ff" }}>
          <p style={{ color, fontWeight: 700, fontSize: 13 }}>Cumplimiento: {cumpl}%</p>
          <div style={{ marginTop: 4, height: 6, background: "#f3e8ff", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(Number(cumpl), 100)}%`, background: color, borderRadius: 99 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function TooltipComparativo({ active, payload, label, fmt, keyActual, keyAnterior, labelActual, labelAnterior }) {
  if (!active || !payload?.length) return null;
  const actual   = payload.find((p) => p.dataKey === (keyActual   ?? "gmvActualConv"))?.value   ?? 0;
  const anterior = payload.find((p) => p.dataKey === (keyAnterior ?? "gmvAnteriorConv"))?.value ?? 0;
  const crec = anterior > 0 ? (((actual - anterior) / anterior) * 100).toFixed(2) : null;
  const color = crec ? (Number(crec) >= 0 ? "#22c55e" : "#ef4444") : "#6b7280";

  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill, marginBottom: 4 }}>
          {p.name} : <strong>{fmt ? fmt(p.value) : p.value}</strong>
        </p>
      ))}
      {crec && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f3e8ff" }}>
          <p style={{ color, fontWeight: 700, fontSize: 14 }}>
            {Number(crec) >= 0 ? "▲" : "▼"} Crecimiento: {crec}%
          </p>
          <div style={{ marginTop: 4, height: 6, background: "#f0fdf4", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(Math.abs(Number(crec)), 100)}%`, background: color, borderRadius: 99 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function TooltipSimple({ active, payload, label, fmt, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill ?? p.color ?? "#8B2FC9", marginBottom: 4 }}>
          {p.name} : <strong>{fmt ? fmt(p.value) : p.value}{unit ?? ""}</strong>
        </p>
      ))}
    </div>
  );
}

export function TooltipCrecimiento({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const color = val >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</p>
      <p style={{ color, fontWeight: 700, fontSize: 14 }}>
        {val >= 0 ? "▲" : "▼"} {Math.abs(val).toFixed(2)}%
      </p>
      <div style={{ marginTop: 4, height: 6, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(Math.abs(val), 100)}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}
