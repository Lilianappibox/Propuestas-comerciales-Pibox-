import { useState, useRef, useEffect } from "react";
import { KAM_MAP } from "./excelParser";
import { fmtM } from "./utils";
import { useMoneda } from "./MonedaContext";

// Misma lógica que homologarKAM en excelParser
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

// Procesa las filas agregadas de ClickHouse (fecha, account_manager, servicios, gmv)
// y devuelve { gmvActual, evolucion, kamGmv, ciudades }
function procesarFilas(rows) {
  const porDia    = {}; // fecha → { gmv, servicios }
  const porKam    = {}; // kamNombre → { gmv, servicios }
  const setCiudades = new Set();

  for (const r of rows) {
    const gmv  = Number(r.gmv)       || 0;
    const serv = Number(r.servicios) || 0;
    const fecha = r.fecha?.slice(0, 10) || "";
    const kam   = homologarKAM(r.account_manager);
    const city  = r.city || "";

    if (fecha) {
      if (!porDia[fecha]) porDia[fecha] = { gmv: 0, servicios: 0 };
      porDia[fecha].gmv      += gmv;
      porDia[fecha].servicios += serv;
    }
    if (r.account_manager) {
      const rawKam  = String(r.account_manager).trim();
      const homoKam = homologarKAM(rawKam);
      // Agrupar por nombre raw para preservarlo; la clave del mapa es el raw
      if (!porKam[rawKam]) porKam[rawKam] = { rawNombre: rawKam, nombre: homoKam, gmv: 0, servicios: 0 };
      porKam[rawKam].gmv      += gmv;
      porKam[rawKam].servicios += serv;
    }
    if (city) setCiudades.add(city);
  }

  // Evolución diaria con GMV acumulado
  const evolucion = Object.entries(porDia)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, v]) => ({ fecha, ...v }));
  let ac = 0;
  evolucion.forEach(d => { ac += d.gmv; d.gmvAcumulado = ac; });

  const gmvActual = Math.round(ac);

  // KAMs ordenados por GMV desc (incluye rawNombre para matching posterior)
  const kamGmv = Object.values(porKam)
    .sort((a, b) => b.gmv - a.gmv);

  const ciudades = [...setCiudades].sort();

  return { gmvActual, evolucion, kamGmv, ciudades };
}

export default function ProyeccionClickhouse({ onDataLoaded }) {
  const { moneda, trm } = useMoneda();
  const Mx = (n) => fmtM(n, moneda, trm);

  const [desde, setDesde] = useState(primerDiaMesActual);
  const [hasta, setHasta] = useState(hoy);
  const [status, setStatus] = useState("idle"); // idle | loading | polling | done | error
  const [msg, setMsg]       = useState("");
  const [resultado, setResultado] = useState(null); // { gmvActual, evolucion, kamGmv, ciudades }
  const [filtroKam, setFiltroKam] = useState("Todos");
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const guardarYNotificar = (data) => {
    const { gmvActual, evolucion, kamGmv, ciudades } = data;
    // Guardar evolución en localStorage (mismo formato que UploadEvolucion)
    try { localStorage.setItem("pibox_cierre_evolucion", JSON.stringify(evolucion)); } catch {}
    setResultado(data);
    setStatus("done");
    setMsg(`✅ ${evolucion.length} días · ${kamGmv.length} KAMs · ${ciudades.length} ciudades`);
    onDataLoaded({ gmvActual, evolucion, kamGmv });
  };

  const cargar = async () => {
    if (status === "loading" || status === "polling") return;
    setStatus("loading");
    setMsg("⏳ Iniciando consulta en ClickHouse…");
    setResultado(null);
    try {
      const res  = await fetch(`/api/cierre_proyeccion/consulta?desde=${desde}&hasta=${hasta}`);
      const json = await res.json();

      if (json.status === "done") {
        guardarYNotificar(procesarFilas(json.data));
        return;
      }
      if (json.status === "error") {
        setStatus("error");
        setMsg(`❌ ${json.error}`);
        return;
      }
      // running
      setStatus("polling");
      setMsg("⏳ Consultando ClickHouse… (esto puede tomar hasta 1 min)");
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 120) {
          clearInterval(pollRef.current);
          setStatus("error");
          setMsg("❌ Tiempo de espera agotado. Intenta de nuevo.");
          return;
        }
        try {
          const r2 = await fetch(`/api/cierre_proyeccion/status?desde=${desde}&hasta=${hasta}`);
          const j2 = await r2.json();
          if (j2.status === "done") {
            clearInterval(pollRef.current);
            guardarYNotificar(procesarFilas(j2.data));
          } else if (j2.status === "error") {
            clearInterval(pollRef.current);
            setStatus("error");
            setMsg(`❌ ${j2.error}`);
          }
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
    setResultado(null);
    setFiltroKam("Todos");
  };

  const isRunning = status === "loading" || status === "polling";
  const kamsDisp  = resultado ? ["Todos", ...resultado.kamGmv.map(k => k.nombre)] : [];
  const kamsFilt  = resultado
    ? (filtroKam === "Todos" ? resultado.kamGmv : resultado.kamGmv.filter(k => k.nombre === filtroKam))
    : [];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-blue-800">🏢 Sincronizar desde ClickHouse</p>
          <p className="text-xs text-gray-500">Actualiza GMV Actual, Evolución Diaria y Facturación por KAM automáticamente.</p>
        </div>
        {resultado && (
          <button onClick={limpiar} className="text-xs text-gray-400 hover:text-gray-600 font-medium">✕ Limpiar</button>
        )}
      </div>

      {/* Rango de fechas */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
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

      {/* Mensaje de estado */}
      {msg && (
        <p className={`text-xs px-3 py-1.5 rounded-lg mb-3 ${
          status === "error" ? "bg-red-50 text-red-600 border border-red-200"
          : status === "done" ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {msg}
        </p>
      )}

      {/* Resultados */}
      {resultado && (
        <div className="space-y-3">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-xs text-gray-400">GMV Período</p>
              <p className="text-base font-bold text-purple-700">{Mx(resultado.gmvActual)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-xs text-gray-400">Días con datos</p>
              <p className="text-base font-bold text-blue-700">{resultado.evolucion.length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-xs text-gray-400">Ciudades</p>
              <p className="text-base font-bold text-green-700">{resultado.ciudades.length}</p>
            </div>
          </div>

          {/* Facturación por KAM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-gray-700">💼 Facturación por KAM</p>
              {/* Filtro ciudad implícito: todos (se puede agregar aquí) */}
            </div>
            {/* Filtro KAM */}
            <div className="flex flex-wrap gap-1 mb-2">
              {kamsDisp.map(k => (
                <button key={k}
                  onClick={() => setFiltroKam(k)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                    filtroKam === k ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:bg-purple-50"
                  }`}>
                  {k}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-purple-50 text-purple-700">
                    <th className="text-left p-1.5">KAM</th>
                    <th className="text-right p-1.5">GMV</th>
                    <th className="text-right p-1.5">Servicios</th>
                    <th className="text-right p-1.5">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {kamsFilt.map((k, i) => (
                    <tr key={k.rawNombre} className={`border-b ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <td className="p-1.5 font-medium text-purple-700">
                        {k.rawNombre}
                        {k.nombre !== k.rawNombre && (
                          <span className="ml-1 text-[10px] text-gray-400">→ {k.nombre}</span>
                        )}
                      </td>
                      <td className="p-1.5 text-right">{Mx(k.gmv)}</td>
                      <td className="p-1.5 text-right text-gray-500">{k.servicios.toLocaleString("es-CO")}</td>
                      <td className="p-1.5 text-right text-gray-500">
                        {resultado.gmvActual > 0 ? ((k.gmv / resultado.gmvActual) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
