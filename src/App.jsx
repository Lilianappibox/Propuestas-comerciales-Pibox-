import { useState, useEffect } from "react";
import { TARIFAS_DEFAULT, MODULOS_CONFIG } from "./data/tarifas";
import { loadUsers, saveUsers, getPermisos, ROLES, fetchCloudUsers, saveCloudUsers } from "./data/users";
import { loadTemplate, saveTemplate, loadHistory, saveHistory, addHistoryEntry } from "./data/templateTexts";
import PropuestaPreview from "./components/PropuestaPreview";
import TarifasEditor from "./components/TarifasEditor";
import UserManager from "./components/UserManager";
import TemplateEditor from "./components/TemplateEditor";
import Login from "./components/Login";
import PropuestasSaved, { loadSaved, storeSaved } from "./components/PropuestasSaved";
import PiboxLogo from "./components/PiboxLogo";
import SyncData from "./components/SyncData";
import CierreComercial  from "./components/CierreComercial";
import RiesgoComercial  from "./components/RiesgoComercial";
import TarifarioInterno from "./components/TarifarioInterno";
import InformeTada from "./components/InformeTada";
import homeBg from "./assets/pibox-home.png";
import "./App.css";

const SK_TARIFAS   = "pibox_tarifas";
const SK_PROPUESTA = "pibox_propuesta_draft";
const SK_SESSION   = "pibox_session";
const SK_MODULOS   = "pibox_modulos_draft";

// Sub-tabs dentro de Propuestas Comerciales
const SUB_BUILDER   = "builder";
const SUB_PREVIEW   = "preview";
const SUB_SAVED     = "saved";
const SUB_TARIFARIO = "tarifario";
const SUB_PLANTILLA = "plantilla";
const SUB_SYNC      = "sync";
const SUB_TARIF_INT = "tarifario-interno";

// Vistas principales
const VIEW_PROPUESTAS = "propuestas";
const VIEW_USUARIOS   = "usuarios";
const VIEW_CIERRE     = "cierre";
const VIEW_RIESGO     = "riesgo";
const VIEW_TADA       = "tada";

const ROLE_COLORS = {
  [ROLES.ADMIN]:     "bg-fuchsia-100 text-fuchsia-700",
  [ROLES.KAM]:       "bg-purple-100 text-purple-700",
  [ROLES.OPERATIVO]: "bg-blue-100 text-blue-700",
};
const ROLE_ICONS = { [ROLES.ADMIN]: "🛡️", [ROLES.KAM]: "💼", [ROLES.OPERATIVO]: "🔧" };

const BRAND_GRADIENT = "linear-gradient(135deg, #5B17A8 0%, #7C22D4 50%, #C026D3 100%)";

const INITIAL_MODULOS = {
  onDemand: true, programadoBloqueHoras: false, programadoRutas: false,
  entregasOptimizadas: false, picarga: false, storage: false,
  adnTecnologico: true, terminosCondiciones: true, cobertura: true,
  coberturaTodasCiudades: false,
};

function loadTarifas() {
  try {
    const s = localStorage.getItem(SK_TARIFAS);
    if (!s) return JSON.parse(JSON.stringify(TARIFAS_DEFAULT));
    const saved = JSON.parse(s);
    if (!saved.storage)             saved.storage             = JSON.parse(JSON.stringify(TARIFAS_DEFAULT.storage));
    if (!saved.entregasOptimizadas) saved.entregasOptimizadas = JSON.parse(JSON.stringify(TARIFAS_DEFAULT.entregasOptimizadas));
    return saved;
  } catch { return JSON.parse(JSON.stringify(TARIFAS_DEFAULT)); }
}

function loadPropuesta() {
  try {
    const s = localStorage.getItem(SK_PROPUESTA);
    const base = { cliente: "", ciudad: "", fecha: new Date().toISOString().slice(0,10), contacto: "", email: "", notas: "", razonSocial: "Digital Platforms Colombia S.A.S." };
    return s ? { ...base, ...JSON.parse(s) } : base;
  } catch { return { cliente: "", ciudad: "", fecha: new Date().toISOString().slice(0,10), contacto: "", email: "", notas: "", razonSocial: "Digital Platforms Colombia S.A.S." }; }
}

function loadModulos() {
  try {
    const s = localStorage.getItem(SK_MODULOS);
    return s ? { ...INITIAL_MODULOS, ...JSON.parse(s) } : { ...INITIAL_MODULOS };
  } catch { return { ...INITIAL_MODULOS }; }
}

export default function App() {
  const [users, setUsers]             = useState(loadUsers);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem(SK_SESSION);
      if (!s) return null;
      const saved = JSON.parse(s);
      // Actualizar permisos desde DEFAULT_USERS del código
      const fromCode = loadUsers().find(u => u.email.toLowerCase() === saved.email.toLowerCase());
      if (fromCode) {
        const merged = { ...saved, permisosCustom: { ...(saved.permisosCustom || {}), ...(fromCode.permisosCustom || {}) } };
        localStorage.setItem(SK_SESSION, JSON.stringify(merged));
        return merged;
      }
      return saved;
    } catch { return null; }
  });
  const [view, setView]             = useState("welcome");
  const [subTab, setSubTab]         = useState(SUB_BUILDER);
  const [propuesta, setPropuesta]   = useState(loadPropuesta);
  const [tarifas, setTarifas]       = useState(loadTarifas);
  const [template, setTemplate]     = useState(loadTemplate);
  const [history, setHistory]       = useState(loadHistory);
  const [modulos, setModulos]       = useState(loadModulos);
  const [saved, setSaved]           = useState(loadSaved);
  const [exportingPdf, setExportingPdf]   = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [savedMsg, setSavedMsg]     = useState("");

  const permisos = currentUser ? getPermisos(currentUser) : {};

  // Sincronizar usuarios desde la nube al iniciar
  useEffect(() => {
    fetchCloudUsers().then(cloud => {
      if (cloud && cloud.length > 0) {
        setUsers(cloud);
        saveUsers(cloud);
        // Refrescar sesión del usuario actual con permisos actualizados
        if (currentUser) {
          const updated = cloud.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
          if (updated && updated.activo) setCurrentUser(updated);
        }
      }
    });
  }, []);

  useEffect(() => { localStorage.setItem(SK_PROPUESTA, JSON.stringify(propuesta)); }, [propuesta]);
  useEffect(() => { localStorage.setItem(SK_TARIFAS, JSON.stringify(tarifas)); }, [tarifas]);
  useEffect(() => { localStorage.setItem(SK_MODULOS, JSON.stringify(modulos)); }, [modulos]);
  useEffect(() => {
    if (currentUser) localStorage.setItem(SK_SESSION, JSON.stringify(currentUser));
    else localStorage.removeItem(SK_SESSION);
  }, [currentUser]);

  const toast = (msg) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(""), 3000); };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setView("welcome");
    setSubTab(SUB_BUILDER);
  };
  const handleLogout = () => {
    localStorage.removeItem(SK_SESSION);
    setCurrentUser(null);
    setView("welcome");
  };

  const handleSaveUsers = (updated) => {
    setUsers(updated); saveUsers(updated);
    saveCloudUsers(updated); // Sincronizar con la nube
    if (currentUser) {
      const r = updated.find((u) => u.id === currentUser.id);
      if (r && r.activo) { setCurrentUser(r); localStorage.setItem(SK_SESSION, JSON.stringify(r)); }
      else handleLogout();
    }
    toast("✓ Usuarios guardados y sincronizados");
  };

  const handleSaveTemplate = (newTexts, camposDirty, oldTexts) => {
    let h = [...history];
    camposDirty.forEach((c) => { h = addHistoryEntry(h, currentUser.id, currentUser.nombre, c.id, oldTexts[c.id], newTexts[c.id]); });
    setTemplate(newTexts); saveTemplate(newTexts);
    setHistory(h); saveHistory(h);
    toast(`✓ Plantilla actualizada (${camposDirty.length} campo${camposDirty.length > 1 ? "s" : ""})`);
  };

  const handleSaveProposal = () => {
    const id = Date.now().toString(36);
    const now = new Date().toISOString();
    const modulosLabel = MODULOS_CONFIG.filter((m) => modulos[m.id]).map((m) => m.emoji).join(" ");
    const entry = {
      id, userId: currentUser.id, userName: currentUser.nombre,
      clienteNombre: propuesta.cliente || "Sin nombre",
      ciudadCliente: propuesta.ciudad,
      nombre: propuesta.cliente,
      modulosLabel,
      estado: "borrador",
      fechaCreacion: now, fechaModificacion: now,
      propuesta: { ...propuesta },
      modulos: { ...modulos },
      tarifasSnapshot: JSON.parse(JSON.stringify(tarifas)),
      templateSnapshot: JSON.parse(JSON.stringify(template)),
    };
    const updated = [entry, ...saved];
    setSaved(updated); storeSaved(updated);
    toast("✓ Propuesta guardada");
  };

  const handleLoadProposal = (p) => {
    setPropuesta(p.propuesta);
    setModulos(p.modulos);
    setTarifas(p.tarifasSnapshot);
    setTemplate(p.templateSnapshot);
    setSubTab(SUB_BUILDER);
    toast(`📂 Cargada: ${p.clienteNombre}`);
  };

  const handleDuplicateProposal = (p) => {
    const now = new Date().toISOString();
    const copy = { ...p, id: Date.now().toString(36), fechaCreacion: now, fechaModificacion: now, estado: "borrador",
      clienteNombre: `${p.clienteNombre} (copia)`, propuesta: { ...p.propuesta, cliente: `${p.propuesta.cliente} (copia)` } };
    const updated = [copy, ...saved];
    setSaved(updated); storeSaved(updated);
    toast("📋 Propuesta duplicada");
  };

  const handleDeleteProposal = (id) => {
    const updated = saved.filter((p) => p.id !== id);
    setSaved(updated); storeSaved(updated);
    toast("🗑️ Propuesta eliminada");
  };

  const handleEstadoProposal = (id, estado) => {
    const updated = saved.map((p) => p.id === id ? { ...p, estado, fechaModificacion: new Date().toISOString() } : p);
    setSaved(updated); storeSaved(updated);
    toast(`✓ Estado actualizado: ${estado}`);
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    const prevTitle = document.title;
    document.title = " ";
    setTimeout(() => { window.print(); document.title = prevTitle; setExportingPdf(false); }, 200);
  };

  const handleExportWord = async () => {
    setExportingWord(true);
    try {
      const { exportToWord } = await import("./utils/exportWord");
      await exportToWord(propuesta, tarifas, modulos, template, currentUser);
    } catch (e) { alert("Error al exportar Word: " + e.message); }
    setExportingWord(false);
  };

  if (!currentUser) return <Login users={users} onLogin={handleLogin} />;

  const modulosActivos = MODULOS_CONFIG.filter((m) => modulos[m.id]).length;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Vistas principales (orden solicitado) ──
  const mainViews = [
    { id: VIEW_PROPUESTAS, label: "Propuestas Comerciales", icon: "📋", visible: !!permisos.verPropuesta },
    { id: VIEW_CIERRE,     label: "Cierre Comercial",       icon: "📊", visible: !!permisos.verCierreComercial },
    { id: VIEW_RIESGO,     label: "Riesgo Comercial",       icon: "🚨", visible: !!permisos.verRiesgoComercial },
    { id: VIEW_TADA,       label: "Informe TaDa",           icon: "🍺", visible: !!permisos.verInformeTada },
    { id: VIEW_USUARIOS,   label: "Usuarios",               icon: "👥", visible: permisos.gestionarUsuarios },
  ].filter((v) => v.visible);

  // ── Sub-tabs de Propuestas Comerciales ──
  const propSubTabs = [
    { id: SUB_BUILDER,   label: "✏️ Propuesta",     icon: "✏️" },
    { id: SUB_PREVIEW,   label: "👁️ Vista Previa",   icon: "👁️" },
    { id: SUB_SAVED,     label: "📁 Mis Propuestas", icon: "📁" },
    { id: SUB_TARIFARIO, label: "💰 Tarifario",      icon: "💰", visible: permisos.verTarifario },
    { id: SUB_PLANTILLA, label: "📝 Plantilla",      icon: "📝", visible: permisos.editarPlantilla },
    { id: SUB_TARIF_INT, label: "📊 Tarifario Interno", icon: "📊" },
    { id: SUB_SYNC,      label: "🔄 Sincronización", icon: "🔄", visible: permisos.gestionarUsuarios },
  ].filter((t) => t.visible !== false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Sidebar vertical ── */}
      <div className={`fixed top-0 left-0 h-full z-50 transition-all duration-300 print:hidden ${sidebarOpen ? "w-64" : "w-16"}`}
        style={{ background: BRAND_GRADIENT }}
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-4 border-b border-white/10">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            <PiboxLogo size="xs" white />
          </div>
          {sidebarOpen && <span className="text-white/70 text-xs tracking-wide whitespace-nowrap">Tablero Comercial</span>}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-2 py-3">
          {mainViews.map((v) => (
            <button key={v.id} onClick={() => { setView(v.id); setSidebarOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                view === v.id
                  ? "bg-white text-purple-700 shadow"
                  : "text-white/80 hover:bg-white/15"
              }`}>
              <span className="text-lg shrink-0 w-6 text-center">{v.icon}</span>
              {sidebarOpen && <span>{v.label}</span>}
            </button>
          ))}
        </nav>

        {/* Usuario (abajo) */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-2 py-3">
          <div className={`flex items-center gap-2 px-3 py-2 ${sidebarOpen ? "" : "justify-center"}`}>
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 font-bold flex items-center justify-center text-sm text-white shrink-0">
              {currentUser.nombre.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{currentUser.nombre}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[currentUser.rol]}`}>
                  {ROLE_ICONS[currentUser.rol]} {currentUser.rol}
                </span>
              </div>
            )}
          </div>
          <button onClick={handleLogout}
            className={`w-full mt-1 text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors ${sidebarOpen ? "text-left" : "text-center"}`}>
            {sidebarOpen ? "↩ Cerrar sesión" : "↩"}
          </button>
        </div>
      </div>

      {/* ── Main content (con margen para sidebar) ── */}
      <div className={`transition-all duration-300 print:ml-0 ${sidebarOpen ? "ml-64" : "ml-16"}`}>

      {/* Toast */}
      {savedMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium print:hidden">
          {savedMsg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           VISTA: PROPUESTAS COMERCIALES
         ══════════════════════════════════════════════════════════════════════ */}
      {view === VIEW_PROPUESTAS && (
        <div className="min-h-[calc(100vh-56px)]">
          {/* Sub-navegación interna */}
          <div className="bg-white border-b border-gray-200 shadow-sm print:hidden">
            <div className="max-w-7xl mx-auto px-4 py-2 flex gap-1 overflow-x-auto">
              {propSubTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    subTab === t.id
                      ? "bg-purple-600 text-white shadow"
                      : "text-gray-600 hover:bg-purple-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-4 py-6 print:p-0 print:max-w-none">

            {/* ── BUILDER ── */}
            {subTab === SUB_BUILDER && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">

                  {/* Datos del cliente */}
                  <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                    <h2 className="font-bold text-gray-800 mb-4 text-base flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 rounded-lg p-1">🏢</span> Datos del Cliente
                    </h2>
                    <div className="space-y-3">
                      {[
                        { label: "Empresa / Cliente *", field: "cliente", placeholder: "Ej: OUR Family SAS" },
                        { label: "Contacto (persona)",  field: "contacto", placeholder: "Ej: María González" },
                        { label: "Correo electrónico",  field: "email",    placeholder: "contacto@empresa.com", type: "email" },
                        { label: "Ciudad",              field: "ciudad",   placeholder: "Ej: Bogotá, Medellín..." },
                      ].map(({ label, field, placeholder, type = "text" }) => (
                        <div key={field}>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
                          <input type={type} placeholder={placeholder} value={propuesta[field]}
                            onChange={(e) => setPropuesta((p) => ({ ...p, [field]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha</label>
                        <input type="date" value={propuesta.fecha}
                          onChange={(e) => setPropuesta((p) => ({ ...p, fecha: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-2 block">🏛️ Razón Social</label>
                        <div className="space-y-2">
                          {["Digital Platforms Colombia S.A.S.", "Digital Network Colombia S.A.S."].map((rs) => (
                            <label key={rs}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                propuesta.razonSocial === rs ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                              }`}>
                              <input type="radio" name="razonSocial" value={rs} checked={propuesta.razonSocial === rs}
                                onChange={() => setPropuesta((p) => ({ ...p, razonSocial: rs }))} className="accent-purple-600" />
                              <span className={`text-sm font-medium ${propuesta.razonSocial === rs ? "text-purple-700" : "text-gray-600"}`}>{rs}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tu perfil */}
                  <div className="rounded-xl p-4 text-white" style={{ background: BRAND_GRADIENT }}>
                    <p className="text-xs font-semibold text-white/80 mb-2 flex items-center gap-1">💼 Tu firma en la propuesta</p>
                    <p className="text-sm font-bold text-white">{currentUser.nombre}</p>
                    {currentUser.cargo && <p className="text-xs text-white/80">{currentUser.cargo}</p>}
                    <p className="text-xs text-white/70">{currentUser.email}</p>
                    {currentUser.celular && <p className="text-xs text-white/70">📱 {currentUser.celular}</p>}
                  </div>

                  {/* Módulos */}
                  <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                    <h2 className="font-bold text-gray-800 mb-1 text-base flex items-center gap-2">
                      <span className="bg-green-100 text-green-700 rounded-lg p-1">🧩</span> Módulos
                    </h2>
                    <p className="text-xs text-gray-500 mb-4">{modulosActivos} módulo(s) seleccionado(s)</p>
                    <div className="space-y-2">
                      {MODULOS_CONFIG.map((m) => (
                        <div key={m.id}>
                          <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                            modulos[m.id] ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200 hover:border-gray-300"}`}>
                            <input type="checkbox" checked={modulos[m.id] || false}
                              onChange={() => setModulos((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                              className="mt-0.5 accent-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{m.label}</p>
                              <p className="text-xs text-gray-500">{m.desc}</p>
                            </div>
                          </label>
                          {m.id === "cobertura" && modulos.cobertura && (
                            <label className="flex items-center gap-2 ml-8 mt-1 mb-1 cursor-pointer">
                              <input type="checkbox" checked={modulos.coberturaTodasCiudades || false}
                                onChange={() => setModulos((prev) => ({ ...prev, coberturaTodasCiudades: !prev.coberturaTodasCiudades }))}
                                className="accent-purple-600" />
                              <span className="text-xs text-purple-700 font-medium">Incluir todas las ciudades de cobertura</span>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                    <h2 className="font-bold text-gray-800 mb-3 text-base flex items-center gap-2">
                      <span className="bg-yellow-100 text-yellow-700 rounded-lg p-1">📝</span> Notas de Negociación
                    </h2>
                    <textarea rows={5} value={propuesta.notas}
                      onChange={(e) => setPropuesta((p) => ({ ...p, notas: e.target.value }))}
                      placeholder="Condiciones especiales, descuentos, observaciones del cliente..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                  </div>

                  {/* Exportar */}
                  <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
                    <h2 className="font-bold text-gray-800 mb-3 text-base flex items-center gap-2">
                      <span className="bg-purple-100 text-purple-700 rounded-lg p-1">⬇️</span> Exportar
                    </h2>
                    <div className="space-y-2">
                      <button onClick={() => setSubTab(SUB_PREVIEW)}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium">
                        👁️ Ver propuesta completa
                      </button>
                      <button onClick={handleExportPdf} disabled={exportingPdf}
                        className="w-full text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                        style={{ background: BRAND_GRADIENT }}>
                        {exportingPdf ? "Preparando PDF..." : "⬇️ Descargar PDF"}
                      </button>
                      <button onClick={handleExportWord} disabled={exportingWord}
                        className="w-full bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors border border-purple-200">
                        {exportingWord ? "Generando Word..." : "⬇️ Descargar Word (.docx)"}
                      </button>
                      <button onClick={handleSaveProposal}
                        className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
                        💾 Guardar propuesta
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 text-center">Los datos se guardan automáticamente como borrador</p>
                  </div>
                </div>

                {/* Preview panel */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Vista Previa</span>
                      <button onClick={() => setSubTab(SUB_PREVIEW)} className="text-xs text-blue-600 hover:underline">Ver completa →</button>
                    </div>
                    <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                      <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: "133.3%" }}>
                        <PropuestaPreview propuesta={propuesta} tarifas={tarifas} modulos={modulos} texts={template} currentUser={currentUser} coberturaTodasCiudades={modulos.coberturaTodasCiudades} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {subTab === SUB_PREVIEW && (
              <div>
                <div className="flex items-center justify-between mb-4 print:hidden">
                  <button onClick={() => setSubTab(SUB_BUILDER)} className="text-sm text-blue-600 hover:underline">← Volver al editor</button>
                  <div className="flex gap-2">
                    <button onClick={handleExportPdf} className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium">⬇️ PDF</button>
                    <button onClick={handleExportWord} disabled={exportingWord} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                      {exportingWord ? "..." : "⬇️ Word"}
                    </button>
                    <button onClick={handleSaveProposal} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium">💾 Guardar</button>
                  </div>
                </div>
                <div className="bg-white shadow-xl rounded-xl overflow-hidden">
                  <PropuestaPreview propuesta={propuesta} tarifas={tarifas} modulos={modulos} texts={template} currentUser={currentUser} coberturaTodasCiudades={modulos.coberturaTodasCiudades} />
                </div>
              </div>
            )}

            {/* ── MIS PROPUESTAS ── */}
            {subTab === SUB_SAVED && (
              <PropuestasSaved saved={saved} currentUser={currentUser}
                onLoad={handleLoadProposal} onDuplicate={handleDuplicateProposal}
                onDelete={handleDeleteProposal} onEstado={handleEstadoProposal} />
            )}

            {/* ── TARIFARIO ── */}
            {subTab === SUB_TARIFARIO && permisos.verTarifario && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Tarifario PIBOX 2026</h2>
                    <p className="text-sm text-gray-500">Se guardan automáticamente. Agrega o elimina ciudades libremente.</p>
                  </div>
                  {permisos.editarTarifas && (
                    <button onClick={() => { if (confirm("¿Restaurar tarifas por defecto?")) { setTarifas(JSON.parse(JSON.stringify(TARIFAS_DEFAULT))); toast("Tarifas restauradas"); } }}
                      className="text-sm text-red-500 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50">
                      🔄 Restaurar
                    </button>
                  )}
                </div>
                {permisos.editarTarifas ? (
                  <TarifasEditor tarifas={tarifas} onChange={(t) => { setTarifas(t); toast("✓ Tarifas guardadas"); }} />
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                    <p className="text-yellow-700 font-medium">🔒 Solo el Administrativo puede editar las tarifas.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── PLANTILLA ── */}
            {subTab === SUB_PLANTILLA && permisos.editarPlantilla && (
              <TemplateEditor texts={template} history={history} onSave={handleSaveTemplate} currentUser={currentUser} />
            )}

            {/* ── SINCRONIZACIÓN ── */}
            {/* ── TARIFARIO INTERNO ── */}
            {subTab === SUB_TARIF_INT && (
              <TarifarioInterno currentUser={currentUser} />
            )}

            {subTab === SUB_SYNC && permisos.gestionarUsuarios && (
              <SyncData />
            )}
          </main>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           VISTA: USUARIOS
         ══════════════════════════════════════════════════════════════════════ */}
      {view === VIEW_USUARIOS && permisos.gestionarUsuarios && (
        <main className="max-w-7xl mx-auto px-4 py-6">
          <UserManager users={users} onSave={handleSaveUsers} />
        </main>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           VISTA: CIERRE COMERCIAL
         ══════════════════════════════════════════════════════════════════════ */}
      {view === VIEW_CIERRE && (
        <CierreComercial currentUser={currentUser} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           VISTA: RIESGO COMERCIAL 360°
         ══════════════════════════════════════════════════════════════════════ */}
      {view === VIEW_RIESGO && permisos.verRiesgoComercial && (
        <RiesgoComercial currentUser={currentUser} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           VISTA: INFORME TADA
         ══════════════════════════════════════════════════════════════════════ */}
      {view === VIEW_TADA && (
        <main className="max-w-7xl mx-auto px-4 py-6">
          <InformeTada isAdmin={currentUser?.rol === "Administrativo"} />
        </main>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           PANTALLA DE BIENVENIDA
         ══════════════════════════════════════════════════════════════════════ */}
      {view === "welcome" && (
        <div className="min-h-screen" style={{ background: `url(${homeBg}) center/cover no-repeat` }} />
      )}
      </div>
    </div>
  );
}
