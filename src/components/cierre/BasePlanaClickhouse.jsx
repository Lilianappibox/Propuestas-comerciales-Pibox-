import { useState, useRef, useEffect } from "react";
import { KAM_MAP } from "./excelParser";

const normK = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function homologarKAM(raw) {
  const key = normK(raw);
  return KAM_MAP[key] || raw;
}

function primerDiaMesActual() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function hoy() { return new Date().toISOString().slice(0, 10); }

function procesarFilas(rows) {
  const porCiudad = {};
  const porKam    = {};
  let gmvTotal    = 0;

  for (const r of rows) {
    const gmv  = Number(r.gmv)       || 0;
    const serv = Number(r.servicios) || 0;
    const city = r.city              || "";
    const raw  = String(r.account_manager || "").trim();
    const kam  = homologarKAM(raw);

    gmvTotal += gmv;

    if (city) {
      if (!porCiudad[city]) porCiudad[city] = { ciudad: city, gmv: 0 };
      porCiudad[city].gmv += gmv;
    }
    if (raw) {
      if (!porKam[raw]) porKam[raw] = { rawNombre: raw, nombre: kam, gmv: 0, servicios: 0 };
      porKam[raw].gmv      += gmv;
      porKam[raw].servicios += serv;
    }
  }

  gmvTotal = Math.round(gmvTotal);

  const ciudades = Object.values(porCiudad)
    .map(c => ({
      ciudad:        c.ciudad,
      gmv:           Math.round(c.gmv),
      participacion: gmvTotal > 0 ? parseFloat(((c.gmv / gmvTotal) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.gmv - a.gmv);

  const kamGmv = Object.values(porKam).sort((a, b) => b.gmv - a.gmv);

  return { gmvTotal, ciudades, kamGmv };
}

export default function BasePlanaClickhouse({ onDataLoaded }) {
  const [desde,   setDesde]   = useState(primerDiaMesActual);
  const [hasta,   setHasta]   = useState(hoy);
  const [status,  setStatus]  = useState("idle");
  const [msg,     setMsg]     = useState("");
  const [resumen, setResumen] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const aplicar = (data) => {
    setResumen(data);
    setStatus("done");
    setMsg(`✅ ${data.ciudades.length} ciudades · ${data.kamGmv.length} KAMs · GMV $${data.gmvTotal.toLocaleString("es-CO")}`);
    onDataLoaded(data);
  };

  const cargar = async () => {
    if (status === "loading" || status === "polling") return;
    setStatus("loading");
    setMsg("⏳ Iniciando consulta en ClickHouse…");
    setResumen(null);
    try {
      const res  = await fetch(`/api/cierre_proyeccion/consulta?desde=${desde}&hasta=${hasta}`);
      const json = await res.json();

      if (json.status === "done")  { aplicar(procesarFilas(json.data)); return; }
      if (json.status === "error") { setStatus("error"); setMsg(`❌ ${json.error}`); return; }

      setStatus("polling");
      setMsg("⏳ Consultando ClickHouse… (puede tomar hasta 1 min)");
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        if (++attempts > 120) {
          clearInterval(pollRef.current);
          setStatus("error");
          setMsg("❌ Tiempo de espera agotado. Intenta de nuevo.");
          return;
        }
        try {
          const r2 = await fetch(`/api/cierre_proyeccion/status?desde=${desde}&hasta=${hasta}`);
          const j2 = await r2.json();
          if (j2.status === "done")  { clearInterval(pollRef.current); aplicar(procesarFilas(j2.data)); }
          else if (j2.status === "error") { clearInterval(pollRef.current); setStatus("error"); setMsg(`❌ ${j2.error}`); }
        } catch {}
      }, 5000);
    } catch (err) {
      setStatus("error");
      setMsg(`❌ Error de red: ${err.message}`);
    }
  };

  const limpiar = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setMsg("");
    setResumen(null);
  };

  const isRunning = status === "loading" || status === "polling";

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-bold text-blue-800">🏢 Sincronizar desde ClickHouse</p>
          <p className="text-xs text-gray-500">
            Actualiza GMV Real, Ciudades y GMV por KAM automáticamente.
          </p>
        </div>
        {resumen && (
          <button onClick={limpiar} className="text-xs text-gray-400 hover:text-gray-600 font-medium">
            ✕ Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            disabled={isRunning}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 disabled:opacity-50" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            disabled={isRunning}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 disabled:opacity-50" />
        </div>
        <button
          onClick={cargar}
          disabled={isRunning}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-bold shadow transition
            ${isRunning ? "bg-blue-300 cursor-wait" : "bg-blue-600 hover:bg-blue-700 cursor-pointer"}`}
        >
          {isRunning
            ? <><span className="animate-spin">⏳</span> Consultando…</>
            : <><span>⚡</span> Cargar desde ClickHouse</>}
        </button>
      </div>

      {msg && (
        <p className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
          status === "error" ? "bg-red-50 text-red-600 border border-red-200"
          : status === "done" ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {msg}
        </p>
      )}
    </div>
  );
}
