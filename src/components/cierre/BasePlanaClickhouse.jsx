import { useState, useRef, useEffect } from "react";
import { KAM_MAP } from "./excelParser";

const MESES = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11 };
const normK = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function calcDates(periodo, anio) {
  const mesIdx = MESES[normK(periodo)] ?? new Date().getMonth();
  const year   = Number(anio) || new Date().getFullYear();

  const actualDesde = new Date(year, mesIdx, 1).toISOString().slice(0, 10);
  const actualHasta = new Date().toISOString().slice(0, 10);

  const prevIdx  = mesIdx === 0 ? 11 : mesIdx - 1;
  const prevYear = mesIdx === 0 ? year - 1 : year;
  const anteriorDesde = new Date(prevYear, prevIdx, 1).toISOString().slice(0, 10);
  const anteriorHasta = new Date(prevYear, prevIdx + 1, 0).toISOString().slice(0, 10);

  return { actualDesde, actualHasta, anteriorDesde, anteriorHasta };
}

/**
 * Convierte las filas de ClickHouse (company, account_manager, city, operation_type, servicios, gmv)
 * al mismo formato que aggregateBase() produce desde Excel:
 *   { companies: { nombre → {kam, gmv, servicios, paquetes} }, lineas: {...}, ciudades: { ciudad → gmv } }
 * Además devuelve resumen para mostrar en pantalla.
 */
function procesarFilas(rows) {
  const companies = {};
  const lineas    = {};
  const ciudades  = {};

  for (const r of rows) {
    const gmv     = Number(r.gmv)         || 0;
    const serv    = Number(r.servicios)   || 0;
    const pkgs    = Number(r.packages)    || 0;
    const company = String(r.company     || "").trim();
    const rawKam  = String(r.account_manager || "").trim();
    const kam     = KAM_MAP[normK(rawKam)] || rawKam;
    const city    = String(r.city        || "").trim();
    const opType  = String(r.operation_type || "").trim();

    if (company) {
      if (!companies[company]) companies[company] = { kam, gmv: 0, servicios: 0, paquetes: 0 };
      companies[company].gmv      += gmv;
      companies[company].servicios += serv;
      companies[company].paquetes  += pkgs;
      if (kam) companies[company].kam = kam;
    }
    if (opType) {
      if (!lineas[opType]) lineas[opType] = { gmv: 0, servicios: 0, paquetes: 0 };
      lineas[opType].gmv      += gmv;
      lineas[opType].servicios += serv;
      lineas[opType].paquetes  += pkgs;
    }
    if (city) ciudades[city] = (ciudades[city] || 0) + gmv;
  }

  const gmvTotal = Math.round(Object.values(companies).reduce((a, c) => a + c.gmv, 0));
  const nCiudades = Object.keys(ciudades).length;
  const nKams     = new Set(Object.values(companies).map(c => c.kam).filter(Boolean)).size;
  const nEmpresas = Object.keys(companies).length;

  return { companies, lineas, ciudades, gmvTotal, nCiudades, nKams, nEmpresas };
}

// ── Panel individual ──────────────────────────────────────────────────────────
function PanelCH({ titulo, descripcion, accentColor, initialDesde, initialHasta, onDataLoaded }) {
  const [desde,   setDesde]   = useState(initialDesde);
  const [hasta,   setHasta]   = useState(initialHasta);
  const [status,  setStatus]  = useState("idle");
  const [msg,     setMsg]     = useState("");
  const [resumen, setResumen] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const aplicar = (data) => {
    setResumen(data);
    setStatus("done");
    setMsg(`✅ ${data.nEmpresas} empresas · ${data.nCiudades} ciudades · ${data.nKams} KAMs · GMV $${data.gmvTotal.toLocaleString("es-CO")}`);
    onDataLoaded(data);
  };

  const cargar = async () => {
    if (status === "loading" || status === "polling") return;
    setStatus("loading");
    setMsg("⏳ Iniciando consulta en ClickHouse…");
    setResumen(null);
    try {
      const res  = await fetch(`/api/cierre_base_plana/consulta?desde=${desde}&hasta=${hasta}`);
      const json = await res.json();

      if (json.status === "done")  { aplicar(procesarFilas(json.data)); return; }
      if (json.status === "error") { setStatus("error"); setMsg(`❌ ${json.error}`); return; }

      setStatus("polling");
      setMsg("⏳ Consultando… (puede tomar hasta 1 min)");
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        if (++attempts > 120) {
          clearInterval(pollRef.current);
          setStatus("error");
          setMsg("❌ Tiempo de espera agotado. Intenta de nuevo.");
          return;
        }
        try {
          const r2 = await fetch(`/api/cierre_base_plana/status?desde=${desde}&hasta=${hasta}`);
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
    setStatus("idle"); setMsg(""); setResumen(null);
  };

  const isRunning = status === "loading" || status === "polling";

  const C = {
    indigo: { border: "border-indigo-200", title: "text-indigo-700", btn: "bg-indigo-600 hover:bg-indigo-700", btnDis: "bg-indigo-300" },
    purple: { border: "border-purple-200", title: "text-purple-700", btn: "bg-purple-600 hover:bg-purple-700", btnDis: "bg-purple-300" },
  }[accentColor] || {};

  return (
    <div className={`bg-white border ${C.border} rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wide ${C.title} mb-0.5`}>{titulo}</p>
          <p className="text-xs text-gray-400">{descripcion}</p>
        </div>
        {resumen && (
          <button onClick={limpiar} className="text-xs text-gray-400 hover:text-gray-600 ml-2 shrink-0">✕</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} disabled={isRunning}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 disabled:opacity-50" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} disabled={isRunning}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 disabled:opacity-50" />
        </div>
      </div>

      <button onClick={cargar} disabled={isRunning}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-bold shadow transition
          ${isRunning ? `${C.btnDis} cursor-wait` : `${C.btn} cursor-pointer`}`}>
        {isRunning
          ? <><span className="animate-spin">⏳</span> Consultando…</>
          : <><span>⚡</span> Cargar desde ClickHouse</>}
      </button>

      {msg && (
        <p className={`mt-2 text-xs px-3 py-1.5 rounded-lg border ${
          status === "error" ? "bg-red-50 text-red-600 border-red-200"
          : status === "done" ? "bg-green-50 text-green-700 border-green-200"
          : "bg-blue-50 text-blue-700 border-blue-200"
        }`}>{msg}</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BasePlanaClickhouse({ onActualLoaded, onAnteriorLoaded, periodo, anio }) {
  const { actualDesde, actualHasta, anteriorDesde, anteriorHasta } = calcDates(periodo, anio);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mt-4">
      <p className="text-sm font-bold text-blue-800 mb-1">🏢 Sincronizar desde ClickHouse</p>
      <p className="text-xs text-gray-500 mb-3">
        Fechas pre-calculadas desde la configuración del mes · puedes ajustarlas si es necesario.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <PanelCH
          titulo="Mes anterior"
          descripcion="Actualiza GMV Mes Pasado, crecimiento KAMs y clientes perdidos"
          accentColor="indigo"
          initialDesde={anteriorDesde}
          initialHasta={anteriorHasta}
          onDataLoaded={onAnteriorLoaded}
        />
        <PanelCH
          titulo="Mes actual (cierre)"
          descripcion="Actualiza GMV Real, KAMs, Top 10, Clientes Nuevos, Líneas y Ciudades"
          accentColor="purple"
          initialDesde={actualDesde}
          initialHasta={actualHasta}
          onDataLoaded={onActualLoaded}
        />
      </div>
    </div>
  );
}
