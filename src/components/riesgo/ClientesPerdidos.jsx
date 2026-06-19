import { useState, useMemo } from "react";
import {
  loadMesData, mesesDisponibles, fmtM, fmtFull, fmtPct,
  PIBOX_PURPLE, PIBOX_PINK, SEM_VERDE, SEM_ROJO, SEM_AMARILLO, MESES_ES,
} from "./utils";

const BRAND_GRADIENT = "linear-gradient(135deg,#5B17A8 0%,#7C22D4 50%,#C026D3 100%)";

function prevMonthKey(key, n) {
  let [y, m] = key.split("-").map(Number);
  for (let i = 0; i < n; i++) { m--; if (m < 1) { m = 12; y--; } }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${r[h] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

export default function ClientesPerdidos() {
  const meses = mesesDisponibles();
  const [mesKey, setMesKey] = useState(meses[meses.length - 1]?.key || "");

  const { lostClients, totals, distAgg, analysis, top5 } = useMemo(() => {
    if (!mesKey) return { lostClients: [], totals: {}, distAgg: [], analysis: {}, top5: [] };

    const prevKey = prevMonthKey(mesKey, 1);
    const dataPrev = loadMesData(prevKey);
    const dataActual = loadMesData(mesKey);

    if (!dataPrev?.empresas) return { lostClients: [], totals: {}, distAgg: [], analysis: {}, top5: [] };

    // Companies with gmv > 0 in prev month
    const empresasPrev = dataPrev.empresas.filter(e => e.gmv > 0);

    // Set of companyIds in current month
    const actualIds = new Set();
    const actualByCompany = {};
    if (dataActual?.empresas) {
      for (const e of dataActual.empresas) {
        if (e.companyId) {
          actualIds.add(e.companyId);
          actualByCompany[e.companyId] = e;
        }
      }
    }

    // Lost: had gmv>0 in prev but not in actual (or gmv=0 in actual)
    const lost = empresasPrev.filter(e => {
      if (!e.companyId) return false;
      if (!actualIds.has(e.companyId)) return true;
      const actual = actualByCompany[e.companyId];
      return actual && actual.gmv === 0;
    });

    // Totals from prev month data
    let totalServPrev = 0, totalGmvPrev = 0, totalRelPrev = 0, totalDevPrev = 0;
    const distMap = { "0-3 km": 0, "3-5 km": 0, "5-10 km": 0, "Mas de 10 km": 0 };
    let highCancelCount = 0, highExpiredCount = 0;

    for (const c of lost) {
      totalServPrev += c.total || 0;
      totalGmvPrev += c.gmv || 0;
      totalRelPrev += c.relanzamientos || 0;
      totalDevPrev += c.devueltos || 0;

      if (c.distancias) {
        for (const [rng, cnt] of Object.entries(c.distancias)) {
          const k = rng === "Mas de 10 km" || rng === "Más de 10 km" ? "Mas de 10 km" : rng;
          if (k in distMap) distMap[k] += cnt;
        }
      }

      // Analysis: high cancellation (>20%) or high expiration (>15%)
      const cancRate = c.total > 0 ? c.cancelados / c.total : 0;
      const expRate = c.total > 0 ? c.expirados / c.total : 0;
      if (cancRate > 0.20) highCancelCount++;
      if (expRate > 0.15) highExpiredCount++;
    }

    // Total GMV of prev month to calculate %
    const totalGmvAllPrev = dataPrev.empresas.reduce((s, e) => s + (e.gmv || 0), 0);

    const totalBookings = Object.values(distMap).reduce((s, v) => s + v, 0);
    const distArr = Object.entries(distMap).map(([rng, cnt]) => ({
      rango: rng, bookings: cnt, pct: totalBookings > 0 ? cnt / totalBookings : 0,
    }));

    const t5 = [...lost].sort((a, b) => (b.gmv || 0) - (a.gmv || 0)).slice(0, 5);

    return {
      lostClients: lost,
      totals: {
        clientes: lost.length,
        servicios: totalServPrev,
        gmv: totalGmvPrev,
        pctGmv: totalGmvAllPrev > 0 ? totalGmvPrev / totalGmvAllPrev : 0,
      },
      distAgg: distArr,
      analysis: {
        highCancel: highCancelCount,
        highExpired: highExpiredCount,
        pctHighCancel: lost.length > 0 ? highCancelCount / lost.length : 0,
        pctHighExpired: lost.length > 0 ? highExpiredCount / lost.length : 0,
      },
      top5: t5,
    };
  }, [mesKey]);

  const mesLabel = (key) => {
    if (!key) return "";
    const [y, m] = key.split("-").map(Number);
    return `${MESES_ES[m] || m} ${y}`;
  };

  const handleCSV = () => {
    const rows = lostClients.map(c => ({
      Empresa: c.empresa,
      Ciudad: c.ciudad,
      Ejecutivo: c.ejecutivo,
      "Servicios (prev)": c.total,
      "GMV (prev)": c.gmv,
      "% Cancelacion (prev)": c.total > 0 ? (c.cancelados / c.total * 100).toFixed(1) + "%" : "0%",
      "Relanzamientos (prev)": c.relanzamientos || 0,
      "Devueltos (prev)": c.devueltos || 0,
    }));
    downloadCSV(rows, `clientes_perdidos_${mesKey}.csv`);
  };

  if (!meses.length) {
    return <div className="text-center py-10 text-gray-400 text-sm">No hay meses cargados.</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Month selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Mes:</label>
        <select value={mesKey} onChange={e => setMesKey(e.target.value)}
          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 12px", fontSize: 13, outline: "none" }}>
          {meses.map(m => <option key={m.key} value={m.key}>{mesLabel(m.key)}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>Clientes que estaban en {mesLabel(prevMonthKey(mesKey, 1))} pero no en {mesLabel(mesKey)}</span>
      </div>

      {/* KPI Banner */}
      <div style={{ background: BRAND_GRADIENT, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>Clientes Perdidos - {mesLabel(mesKey)}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          {[
            { label: "Total clientes perdidos", value: totals.clientes || 0 },
            { label: "Servicios perdidos", value: (totals.servicios || 0).toLocaleString() },
            { label: "GMV perdido", value: fmtM(totals.gmv || 0) },
            { label: "% del total GMV", value: fmtPct(totals.pctGmv || 0) },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(4px)" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,.75)", fontWeight: 600, margin: 0, textTransform: "uppercase" }}>{k.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "4px 0 0" }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table of lost clients */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Detalle de clientes perdidos ({lostClients.length})</h4>
          {lostClients.length > 0 && (
            <button onClick={handleCSV} style={{ background: SEM_VERDE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Descargar CSV
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 850 }}>
            <thead>
              <tr>
                {["Empresa", "Ciudad", "Ejecutivo", "Servicios (prev)", "GMV (prev)", "% Cancelacion (prev)", "Relanzamientos (prev)", "Devueltos (prev)"].map(h => (
                  <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lostClients.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>No se encontraron clientes perdidos en este mes.</td></tr>
              ) : lostClients.sort((a, b) => (b.gmv || 0) - (a.gmv || 0)).map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>{c.empresa}</td>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{c.ciudad}</td>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{c.ejecutivo}</td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.total}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: SEM_ROJO }}>{fmtM(c.gmv)}</td>
                  <td style={{ padding: "6px 10px", color: c.total > 0 && c.cancelados / c.total > 0.20 ? SEM_ROJO : "#374151" }}>
                    {c.total > 0 ? fmtPct(c.cancelados / c.total) : "0.0%"}
                  </td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.relanzamientos || 0}</td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.devueltos || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distance distribution */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Distribucion por rango de distancia (mes anterior)</h4>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rango", "Total bookings", "% del total"].map(h => (
                  <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distAgg.map((d, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "6px 12px", fontWeight: 600, color: "#374151" }}>{d.rango}</td>
                  <td style={{ padding: "6px 12px", color: "#374151" }}>{d.bookings.toLocaleString()}</td>
                  <td style={{ padding: "6px 12px", color: PIBOX_PURPLE }}>{fmtPct(d.pct)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#ede9fe", fontWeight: 700, borderTop: "2px solid #c4b5fd" }}>
                <td style={{ padding: "8px 12px", color: "#1f2937" }}>Total</td>
                <td style={{ padding: "8px 12px", color: "#1f2937" }}>{distAgg.reduce((s, d) => s + d.bookings, 0).toLocaleString()}</td>
                <td style={{ padding: "8px 12px", color: "#1f2937" }}>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Analysis */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, padding: "16px 20px" }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: "0 0 12px" }}>Analisis de clientes perdidos</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          <div style={{ background: analysis.pctHighCancel > 0.5 ? "#fef2f2" : "#f9fafb", border: `1px solid ${analysis.pctHighCancel > 0.5 ? "#fecaca" : "#e5e7eb"}`, borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${SEM_ROJO}` }}>
            <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, margin: 0 }}>Alta cancelacion (&gt;20%)</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: SEM_ROJO, margin: "4px 0 2px" }}>{analysis.highCancel || 0} clientes</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{fmtPct(analysis.pctHighCancel || 0)} de los perdidos</p>
          </div>
          <div style={{ background: analysis.pctHighExpired > 0.5 ? "#fffbeb" : "#f9fafb", border: `1px solid ${analysis.pctHighExpired > 0.5 ? "#fde68a" : "#e5e7eb"}`, borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${SEM_AMARILLO}` }}>
            <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, margin: 0 }}>Alta expiracion (&gt;15%)</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: SEM_AMARILLO, margin: "4px 0 2px" }}>{analysis.highExpired || 0} clientes</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{fmtPct(analysis.pctHighExpired || 0)} de los perdidos</p>
          </div>
        </div>
      </div>

      {/* Top 5 by GMV */}
      {top5.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 10 }}>Top 5 perdidos por GMV</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {top5.map((c, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", borderLeft: `4px solid ${SEM_ROJO}`, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>#{i + 1}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#1f2937", margin: "4px 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.empresa}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: SEM_ROJO, margin: "4px 0 2px" }}>{fmtFull(c.gmv)}</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{c.total} servicios - {c.ciudad}</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{c.ejecutivo}</p>
                {c.total > 0 && (
                  <p style={{ fontSize: 10, color: c.cancelados / c.total > 0.20 ? SEM_ROJO : "#9ca3af", margin: "2px 0 0" }}>
                    Cancel: {fmtPct(c.cancelados / c.total)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
