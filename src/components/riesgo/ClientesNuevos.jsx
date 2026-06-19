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

export default function ClientesNuevos() {
  const meses = mesesDisponibles();
  const [mesKey, setMesKey] = useState(meses[meses.length - 1]?.key || "");

  const { newClients, totals, distAgg, relaunchDist, top5 } = useMemo(() => {
    if (!mesKey) return { newClients: [], totals: {}, distAgg: [], relaunchDist: [], top5: [] };

    const dataActual = loadMesData(mesKey);
    if (!dataActual?.empresas) return { newClients: [], totals: {}, distAgg: [], relaunchDist: [], top5: [] };

    // Gather companyIds from 3 previous calendar months
    const prevIds = new Set();
    for (let n = 1; n <= 3; n++) {
      const pk = prevMonthKey(mesKey, n);
      const d = loadMesData(pk);
      if (d?.empresas) {
        for (const e of d.empresas) {
          if (e.companyId) prevIds.add(e.companyId);
        }
      }
    }

    // New clients: in current month but not in prev 3
    const nc = dataActual.empresas.filter(e => e.companyId && !prevIds.has(e.companyId));

    // Aggregates
    let totalServ = 0, totalGmv = 0, totalComp = 0, totalCanc = 0, totalExp = 0, totalRelaunch = 0, totalDev = 0;
    const distMap = { "0-3 km": 0, "3-5 km": 0, "5-10 km": 0, "Mas de 10 km": 0 };
    const distTimes = {};
    const relaunchBuckets = { 0: 0, 1: 0, 2: 0, "3+": 0 };

    for (const c of nc) {
      totalServ += c.total || 0;
      totalGmv += c.gmv || 0;
      totalComp += c.completados || 0;
      totalCanc += c.cancelados || 0;
      totalExp += c.expirados || 0;
      totalRelaunch += c.relanzamientos || 0;
      totalDev += c.devueltos || 0;

      // Distance aggregation with times
      if (c.distancias) {
        for (const [rng, val] of Object.entries(c.distancias)) {
          const k = rng === "Mas de 10 km" || rng === "Más de 10 km" ? "Mas de 10 km" : rng;
          if (!(k in distMap)) continue;
          if (typeof val === "number") { distMap[k] += val; continue; } // legacy
          distMap[k] += val.total || 0;
          if (!distTimes[k]) distTimes[k] = { completados: 0, relanzamientos: 0, tAsig: 0, tLleg: 0, tRec: 0, tRuta: 0, tTotal: 0, n: 0 };
          distTimes[k].completados += val.completados || 0;
          distTimes[k].relanzamientos += val.relanzamientos || 0;
          distTimes[k].tAsig += val.tAsignacion || 0;
          distTimes[k].tLleg += val.tLlegada || 0;
          distTimes[k].tRec += val.tRecogida || 0;
          distTimes[k].tRuta += val.tRuta || 0;
          distTimes[k].tTotal += val.tTotal || 0;
          distTimes[k].n += val.nTiempos || 0;
        }
      }
    }

    const totalBookings = Object.values(distMap).reduce((s, v) => s + v, 0);
    const fmtTime = (mins) => { if (!mins) return "—"; const h = Math.floor(mins/60); const m = Math.round(mins%60); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; };
    const distArr = Object.entries(distMap).map(([rng, cnt]) => {
      const t = distTimes[rng] || {};
      const n = t.n || 1;
      return { rango: rng, bookings: cnt, pct: totalBookings > 0 ? cnt / totalBookings : 0, completados: t.completados || 0, relanzamientos: t.relanzamientos || 0, efectividad: cnt > 0 ? (t.completados || 0) / cnt : 0, avgAsig: fmtTime(t.tAsig / n), avgLleg: fmtTime(t.tLleg / n), avgRuta: fmtTime(t.tRuta / n), avgTotal: fmtTime(t.tTotal / n) };
    });

    const relaunchArr = Object.entries(relaunchBuckets).map(([k, v]) => ({ bucket: k, count: v }));

    const t5 = [...nc].sort((a, b) => (b.gmv || 0) - (a.gmv || 0)).slice(0, 5);

    return {
      newClients: nc,
      totals: { servicios: totalServ, gmv: totalGmv, completados: totalComp, cancelados: totalCanc, expirados: totalExp, relanzamientos: totalRelaunch, devueltos: totalDev, pctComp: totalServ > 0 ? totalComp / totalServ : 0, pctCanc: totalServ > 0 ? totalCanc / totalServ : 0 },
      distAgg: distArr,
      relaunchDist: relaunchArr,
      top5: t5,
    };
  }, [mesKey]);

  const mesLabel = (key) => {
    if (!key) return "";
    const [y, m] = key.split("-").map(Number);
    return `${MESES_ES[m] || m} ${y}`;
  };

  const handleCSV = () => {
    const rows = newClients.map(c => ({
      Empresa: c.empresa,
      Ciudad: c.ciudad,
      Ejecutivo: c.ejecutivo,
      Servicios: c.total,
      Completados: c.completados,
      Cancelados: c.cancelados,
      Expirados: c.expirados,
      GMV: c.gmv,
      Relanzamientos: c.relanzamientos || 0,
      Devueltos: c.devueltos || 0,
    }));
    downloadCSV(rows, `clientes_nuevos_${mesKey}.csv`);
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
      </div>

      {/* KPI Banner */}
      <div style={{ background: BRAND_GRADIENT, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>Clientes Nuevos - {mesLabel(mesKey)}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          {[
            { label: "Total clientes nuevos", value: newClients.length },
            { label: "Servicios", value: (totals.servicios || 0).toLocaleString() },
            { label: "GMV", value: fmtM(totals.gmv || 0) },
            { label: "% Completado", value: fmtPct(totals.pctComp || 0) },
            { label: "% Cancelacion", value: fmtPct(totals.pctCanc || 0) },
            { label: "Relanzamientos", value: (totals.relanzamientos || 0).toLocaleString() },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(4px)" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,.75)", fontWeight: 600, margin: 0, textTransform: "uppercase" }}>{k.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "4px 0 0" }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table of new clients */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Detalle de clientes nuevos ({newClients.length})</h4>
          {newClients.length > 0 && (
            <button onClick={handleCSV} style={{ background: SEM_VERDE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Descargar CSV
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {["Empresa", "Ciudad", "Ejecutivo", "Servicios", "Completados", "Cancelados", "Expirados", "GMV", "Relanzamientos", "Devueltos"].map(h => (
                  <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {newClients.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>No se encontraron clientes nuevos en este mes.</td></tr>
              ) : newClients.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>{c.empresa}</td>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{c.ciudad}</td>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{c.ejecutivo}</td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.total}</td>
                  <td style={{ padding: "6px 10px", color: SEM_VERDE }}>{c.completados}</td>
                  <td style={{ padding: "6px 10px", color: SEM_ROJO }}>{c.cancelados}</td>
                  <td style={{ padding: "6px 10px", color: SEM_AMARILLO }}>{c.expirados}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: PIBOX_PURPLE }}>{fmtM(c.gmv)}</td>
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
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Cumplimiento por rango de distancia</h4>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rango", "Bookings", "Relanzamientos", "Efectividad", "T. Asignación", "T. Llegada", "T. Ruta", "T. Total", "% Bookings"].map(h => (
                  <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distAgg.map((d, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "5px 8px", fontWeight: 600, color: "#374151" }}>{d.rango}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>{d.bookings.toLocaleString()}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>{d.relanzamientos.toLocaleString()}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 600, color: d.efectividad >= 0.9 ? SEM_VERDE : d.efectividad >= 0.75 ? SEM_AMARILLO : SEM_ROJO }}>{fmtPct(d.efectividad)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#6b7280" }}>{d.avgAsig}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#6b7280" }}>{d.avgLleg}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#6b7280" }}>{d.avgRuta}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 600, color: "#374151" }}>{d.avgTotal}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: PIBOX_PURPLE }}>{fmtPct(d.pct)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#ede9fe", fontWeight: 700, borderTop: "2px solid #c4b5fd" }}>
                <td style={{ padding: "7px 8px", color: "#1f2937" }}>Total</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>{distAgg.reduce((s, d) => s + d.bookings, 0).toLocaleString()}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>{distAgg.reduce((s, d) => s + d.relanzamientos, 0).toLocaleString()}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }} colSpan={5}></td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Relaunch distribution */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Distribucion de relanzamientos</h4>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Nota: el conteo de relanzamientos es agregado por empresa; la distribucion individual por servicio no esta disponible en los datos almacenados.</p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Empresa", "Relanzamientos totales", "Servicios", "Promedio por servicio"].map(h => (
                  <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {newClients.filter(c => (c.relanzamientos || 0) > 0).sort((a, b) => (b.relanzamientos || 0) - (a.relanzamientos || 0)).map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "6px 12px", fontWeight: 600, color: "#374151" }}>{c.empresa}</td>
                  <td style={{ padding: "6px 12px", color: "#374151" }}>{(c.relanzamientos || 0).toLocaleString()}</td>
                  <td style={{ padding: "6px 12px", color: "#6b7280" }}>{c.total}</td>
                  <td style={{ padding: "6px 12px", color: PIBOX_PURPLE }}>{c.total > 0 ? ((c.relanzamientos || 0) / c.total).toFixed(2) : "0"}</td>
                </tr>
              ))}
              {newClients.filter(c => (c.relanzamientos || 0) > 0).length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}>Sin relanzamientos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Devoluciones por empresa */}
      {(() => {
        const devolData = newClients.filter(c => (c.devueltos||0) > 0)
          .map(c => ({ empresa: c.empresa, paquetes: c.paquetes||0, devueltos: c.devueltos||0, tasa: (c.paquetes||0) > 0 ? (c.devueltos||0)/(c.paquetes||0) : 0 }))
          .sort((a,b) => b.devueltos - a.devueltos);
        if (!devolData.length) return null;
        const totPaq = devolData.reduce((s,d) => s+d.paquetes, 0);
        const totDev = devolData.reduce((s,d) => s+d.devueltos, 0);
        const totTasa = totPaq > 0 ? totDev/totPaq : 0;
        return (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Devoluciones por empresa</h4>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Empresa","Paquetes","Devueltos","Tasa devolucion (%)"].map(h => (
                      <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devolData.map((d,i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                      <td style={{ padding: "6px 12px", fontWeight: 600, color: "#374151" }}>{d.empresa}</td>
                      <td style={{ padding: "6px 12px", color: "#374151" }}>{d.paquetes.toLocaleString()}</td>
                      <td style={{ padding: "6px 12px", color: "#374151" }}>{d.devueltos.toLocaleString()}</td>
                      <td style={{ padding: "6px 12px", fontWeight: 600, color: d.tasa > 0.10 ? SEM_ROJO : d.tasa > 0.05 ? SEM_AMARILLO : SEM_VERDE }}>{fmtPct(d.tasa)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#ede9fe", fontWeight: 700, borderTop: "2px solid #c4b5fd" }}>
                    <td style={{ padding: "7px 12px", color: "#1f2937" }}>Total</td>
                    <td style={{ padding: "7px 12px" }}>{totPaq.toLocaleString()}</td>
                    <td style={{ padding: "7px 12px" }}>{totDev.toLocaleString()}</td>
                    <td style={{ padding: "7px 12px", fontWeight: 600, color: totTasa > 0.10 ? SEM_ROJO : totTasa > 0.05 ? SEM_AMARILLO : SEM_VERDE }}>{fmtPct(totTasa)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Top 5 by GMV */}
      {top5.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 10 }}>Top 5 nuevos por GMV</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {top5.map((c, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", borderLeft: `4px solid ${PIBOX_PURPLE}`, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>#{i + 1}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#1f2937", margin: "4px 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.empresa}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: PIBOX_PURPLE, margin: "4px 0 2px" }}>{fmtFull(c.gmv)}</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{c.total} servicios - {c.ciudad}</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{c.ejecutivo}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
