import { useState, useMemo, useEffect } from "react";
import {
  loadMesData, mesesDisponibles, fmtM, fmtFull, fmtPct,
  PIBOX_PURPLE, PIBOX_PINK, SEM_VERDE, SEM_ROJO, SEM_AMARILLO, MESES_ES,
} from "./utils";
import { useRiesgoFilter, empresaMatchesOpType } from "./RiesgoContext";

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
  const { filterOpType } = useRiesgoFilter();
  const [mesKey, setMesKey] = useState(meses[meses.length - 1]?.key || "");
  useEffect(() => {
    if (meses.length > 0 && (!mesKey || !meses.find(m => m.key === mesKey)))
      setMesKey(meses[meses.length - 1].key);
  }, [meses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [filtBuscar, setFiltBuscar] = useState("");
  const [filtCiudad, setFiltCiudad] = useState("");
  const [filtEjecutivo, setFiltEjecutivo] = useState("");
  const [filtOrden, setFiltOrden] = useState("gmv");

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
    const nc = dataActual.empresas.filter(e => e.companyId && !prevIds.has(e.companyId) && empresaMatchesOpType(e, filterOpType));

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
          if (!distTimes[k]) distTimes[k] = { completados: 0, relanzamientos: 0, tAsig: 0, tLleg: 0, tRec: 0, tRuta: 0, tTotal: 0, n: 0, otTotal: 0, otOnTime: 0, otNoAplica: 0 };
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
      // On Time aggregation from On Demand distances
      if (c.distanciasOnDemand) {
        for (const [rng, val] of Object.entries(c.distanciasOnDemand)) {
          const k = rng === "Mas de 10 km" || rng === "Más de 10 km" ? "Mas de 10 km" : rng;
          if (!(k in distMap) || typeof val !== "object") continue;
          if (!distTimes[k]) distTimes[k] = { completados: 0, relanzamientos: 0, tAsig: 0, tLleg: 0, tRec: 0, tRuta: 0, tTotal: 0, n: 0, otTotal: 0, otOnTime: 0, otNoAplica: 0 };
          distTimes[k].otTotal = (distTimes[k].otTotal || 0) + (val.otTotal || 0);
          distTimes[k].otOnTime = (distTimes[k].otOnTime || 0) + (val.otOnTime || 0);
          distTimes[k].otNoAplica = (distTimes[k].otNoAplica || 0) + (val.otNoAplica || 0);
        }
      }
    }

    const totalBookings = Object.values(distMap).reduce((s, v) => s + v, 0);
    const fmtTime = (mins) => { if (!mins) return "—"; const h = Math.floor(mins/60); const m = Math.round(mins%60); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; };
    const distArr = Object.entries(distMap).map(([rng, cnt]) => {
      const t = distTimes[rng] || {};
      const n = t.n || 1;
      return { rango: rng, bookings: cnt, pct: totalBookings > 0 ? cnt / totalBookings : 0, completados: t.completados || 0, relanzamientos: t.relanzamientos || 0, efectividad: cnt > 0 ? (t.completados || 0) / cnt : 0, avgAsig: fmtTime(t.tAsig / n), avgLleg: fmtTime(t.tLleg / n), avgRuta: fmtTime(t.tRuta / n), avgTotal: fmtTime(t.tTotal / n), otTotal: t.otTotal || 0, otOnTime: t.otOnTime || 0, otNoAplica: t.otNoAplica || 0, onTimePct: (t.otTotal || 0) > 0 ? (t.otOnTime || 0) / (t.otTotal || 0) : null };
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
  }, [mesKey, filterOpType]);

  const mesLabel = (key) => {
    if (!key) return "";
    const [y, m] = key.split("-").map(Number);
    return `${MESES_ES[m] || m} ${y}`;
  };
  // Usa el label del índice si existe (rango ClickHouse), si no el nombre del mes
  const getMesLabel = (key) => meses.find(m => m.key === key)?.label || mesLabel(key);

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
          {meses.map(m => <option key={m.key} value={m.key}>{m.label || mesLabel(m.key)}</option>)}
        </select>
      </div>

      {/* KPI Banner */}
      <div style={{ background: BRAND_GRADIENT, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: "0 0 12px" }}>Clientes Nuevos - {getMesLabel(mesKey)}</h3>
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
      {(() => {
        const ciudades = [...new Set(newClients.map(c => c.ciudad).filter(Boolean))].sort();
        const ejecutivos = [...new Set(newClients.map(c => c.ejecutivo).filter(Boolean))].sort();
        const filtered = newClients
          .filter(c => !filtBuscar || c.empresa?.toLowerCase().includes(filtBuscar.toLowerCase()))
          .filter(c => !filtCiudad || c.ciudad === filtCiudad)
          .filter(c => !filtEjecutivo || c.ejecutivo === filtEjecutivo)
          .sort((a, b) => filtOrden === "gmv" ? (b.gmv||0)-(a.gmv||0) : filtOrden === "servicios" ? (b.total||0)-(a.total||0) : filtOrden === "completados" ? (b.completados||0)-(a.completados||0) : a.empresa?.localeCompare(b.empresa));
        return (
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Detalle de clientes nuevos ({newClients.length})</h4>
          {newClients.length > 0 && (
            <button onClick={handleCSV} style={{ background: SEM_VERDE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Descargar CSV
            </button>
          )}
        </div>
        {/* Filtros */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Buscar empresa</label>
            <input type="text" value={filtBuscar} onChange={e => setFiltBuscar(e.target.value)} placeholder="Nombre..."
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 11, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Ciudad</label>
            <select value={filtCiudad} onChange={e => setFiltCiudad(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 11, outline: "none" }}>
              <option value="">Todas</option>
              {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Ejecutivo (KAM)</label>
            <select value={filtEjecutivo} onChange={e => setFiltEjecutivo(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 11, outline: "none" }}>
              <option value="">Todos</option>
              {ejecutivos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 3 }}>Ordenar por</label>
            <select value={filtOrden} onChange={e => setFiltOrden(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 11, outline: "none" }}>
              <option value="gmv">Mayor GMV</option>
              <option value="servicios">Mayor Servicios</option>
              <option value="completados">Mayor Completados</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>
          {(filtBuscar || filtCiudad || filtEjecutivo) && (
            <button onClick={() => { setFiltBuscar(""); setFiltCiudad(""); setFiltEjecutivo(""); }}
              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer" }}>
              Limpiar
            </button>
          )}
          <span style={{ fontSize: 10, color: "#9ca3af" }}>{filtered.length} de {newClients.length}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {["Empresa", "Ciudad", "Ejecutivo (KAM)", "Servicios", "Completados", "Cancelados", "Expirados", "GMV", "On Time OD", "Con SLA", "Sin SLA", "Relanzamientos", "Devueltos"].map(h => (
                  <th key={h} style={{ background: PIBOX_PURPLE, color: "#fff", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>No se encontraron clientes con los filtros aplicados.</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>{c.empresa}</td>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{c.ciudad}</td>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{c.ejecutivo}</td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.total}</td>
                  <td style={{ padding: "6px 10px", color: SEM_VERDE }}>{c.completados}</td>
                  <td style={{ padding: "6px 10px", color: SEM_ROJO }}>{c.cancelados}</td>
                  <td style={{ padding: "6px 10px", color: SEM_AMARILLO }}>{c.expirados}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: PIBOX_PURPLE, whiteSpace: "nowrap" }}>{fmtFull(c.gmv)}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "#0d9488" }}>{c.onTimePct != null ? fmtPct(c.onTimePct) : "—"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#374151" }}>{c.onDemandCompletados || 0}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", color: "#6b7280" }}>{c.onDemandNoAplica || 0}</td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.relanzamientos || 0}</td>
                  <td style={{ padding: "6px 10px", color: "#374151" }}>{c.devueltos || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        );
      })()}

      {/* Distance distribution */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Cumplimiento por rango de distancia</h4>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rango", "Bookings", "Relanzamientos", "Efectividad", "T. Asignación", "T. Llegada", "T. Ruta", "T. Total", "On Time OD", "Con SLA", "Sin SLA", "% Bookings"].map(h => (
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
                  <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 600, color: "#0d9488" }}>{d.onTimePct != null ? fmtPct(d.onTimePct) : "—"}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#374151" }}>{d.otTotal.toLocaleString()}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#6b7280" }}>{d.otNoAplica.toLocaleString()}</td>
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
                <td style={{ padding: "7px 8px", textAlign: "center", color: "#0d9488" }}>{(() => { const tot = distAgg.reduce((s,d)=>s+(d.otTotal||0),0); const on = distAgg.reduce((s,d)=>s+(d.otOnTime||0),0); return tot > 0 ? fmtPct(on/tot) : "—"; })()}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>{distAgg.reduce((s,d)=>s+(d.otTotal||0),0).toLocaleString()}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>{distAgg.reduce((s,d)=>s+(d.otNoAplica||0),0).toLocaleString()}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Relaunch distribution + Devoluciones — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 20 }}>
      {(() => {
        const relaunchEmps = newClients.filter(c => (c.relanzamientos || 0) > 0).sort((a, b) => (b.relanzamientos || 0) - (a.relanzamientos || 0));
        return (
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Distribucion de relanzamientos</h4>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Nota: el conteo de relanzamientos es agregado por empresa; la distribucion individual por servicio no esta disponible en los datos almacenados.</p>
          </div>
          {relaunchEmps.length > 0 && (
            <button onClick={() => {
              const csv = ["Empresa,Relanzamientos totales,Servicios,Promedio por servicio", ...relaunchEmps.map(c => `"${c.empresa}",${c.relanzamientos||0},${c.total},${c.total > 0 ? ((c.relanzamientos||0)/c.total).toFixed(2) : "0"}`)].join("\n");
              const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "relanzamientos.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, color: "#7C22D4", background: "#f5f3ff", border: "1px solid #ddd6fe", cursor: "pointer" }}>
              📥 Descargar ({relaunchEmps.length})
            </button>
          )}
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
              {relaunchEmps.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}>Sin relanzamientos registrados.</td></tr>
              ) : relaunchEmps.slice(0, 15).map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#faf5ff" }}>
                  <td style={{ padding: "6px 12px", fontWeight: 600, color: "#374151" }}>{c.empresa}</td>
                  <td style={{ padding: "6px 12px", color: "#374151" }}>{(c.relanzamientos || 0).toLocaleString()}</td>
                  <td style={{ padding: "6px 12px", color: "#6b7280" }}>{c.total}</td>
                  <td style={{ padding: "6px 12px", color: PIBOX_PURPLE }}>{c.total > 0 ? ((c.relanzamientos || 0) / c.total).toFixed(2) : "0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {relaunchEmps.length > 15 && (
          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: "8px 0" }}>Mostrando 15 de {relaunchEmps.length}. Descarga CSV para ver todos.</p>
        )}
      </div>
        );
      })()}

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
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", margin: 0 }}>Devoluciones por empresa</h4>
              <button onClick={() => {
                const csv = ["Empresa,Paquetes,Devueltos,Tasa Devolucion", ...devolData.map(d => `"${d.empresa}",${d.paquetes},${d.devueltos},${(d.tasa*100).toFixed(1)}%`)].join("\n");
                const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "devoluciones.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
              }} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, color: "#7C22D4", background: "#f5f3ff", border: "1px solid #ddd6fe", cursor: "pointer" }}>
                📥 Descargar ({devolData.length})
              </button>
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
                  {devolData.slice(0, 15).map((d,i) => (
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
            {devolData.length > 15 && (
              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: "8px 0" }}>Mostrando 15 de {devolData.length}. Descarga CSV para ver todos.</p>
            )}
          </div>
        );
      })()}
      </div>

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
