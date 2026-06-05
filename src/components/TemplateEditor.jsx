import { useState } from "react";
import { TEMPLATE_FIELDS, TEMPLATE_DEFAULT } from "../data/templateTexts";

const SECCIONES = [...new Set(TEMPLATE_FIELDS.map((f) => f.seccion))];

const SECCION_ICONS = {
  "Introducción": "📄",
  "Plataforma Tecnológica": "🔧",
  "Propuesta Comercial": "📋",
  "On Demand": "⚡",
  "Programado — Bloque de Horas": "🛵",
  "Programado — Rutas": "🔁",
  "Entregas Optimizadas": "🚀",
  "Picarga": "🚚",
  "Storage": "📦",
  "ADN Tecnológico": "🔬",
  "Términos y Condiciones": "📋",
  "Aceptación y Contrato": "✒️",
  "Cierre": "✍️",
};

function timeFmt(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function diff(a, b) {
  if (!a && !b) return false;
  return a !== b;
}

export default function TemplateEditor({ texts, history, onSave, currentUser }) {
  const [seccionAbierta, setSeccionAbierta] = useState(SECCIONES[0]);
  const [draft, setDraft] = useState({ ...texts });
  const [verHistorial, setVerHistorial] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const camposDirty = TEMPLATE_FIELDS.filter(
    (f) => diff(draft[f.id], texts[f.id])
  );
  const hayCambios = camposDirty.length > 0;

  const handleChange = (id, value) => {
    setDraft((d) => ({ ...d, [id]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave(draft, camposDirty, texts);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setDraft({ ...TEMPLATE_DEFAULT });
    setConfirmReset(false);
    setSaved(false);
  };

  const handleDiscardField = (id) => {
    setDraft((d) => ({ ...d, [id]: texts[id] }));
  };

  const camposEnSeccion = TEMPLATE_FIELDS.filter(
    (f) => f.seccion === seccionAbierta
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Editor de Plantilla Comercial</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Solo el rol <strong>Administrativo</strong> puede modificar estos textos.
            Cada cambio queda registrado en el historial.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setVerHistorial(!verHistorial)}
            className={`text-sm border rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
              verHistorial
                ? "bg-gray-800 text-white border-gray-800"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            🕐 Historial ({history.length})
          </button>
          {confirmReset ? (
            <div className="flex gap-1">
              <button
                onClick={handleReset}
                className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
              >
                Confirmar restaurar
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="text-sm text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              🔄 Restaurar por defecto
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hayCambios}
            className={`text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors ${
              hayCambios
                ? "bg-blue-700 hover:bg-blue-800 text-white"
                : saved
                ? "bg-green-100 text-green-700 border border-green-300 cursor-default"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saved ? "✓ Guardado" : hayCambios ? `💾 Guardar (${camposDirty.length} cambio${camposDirty.length > 1 ? "s" : ""})` : "Sin cambios"}
          </button>
        </div>
      </div>

      {/* Cambios pendientes banner */}
      {hayCambios && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-amber-600 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {camposDirty.length} campo{camposDirty.length > 1 ? "s" : ""} con cambios sin guardar
            </p>
            <p className="text-xs text-amber-600">
              {camposDirty.map((f) => f.label).join(", ")}
            </p>
          </div>
          <button
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors"
          >
            Guardar ahora
          </button>
        </div>
      )}

      {/* Historial */}
      {verHistorial && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow overflow-hidden">
          <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-sm">🕐 Historial de cambios</span>
            <span className="text-xs text-gray-400">{history.length} registro(s)</span>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No hay cambios registrados aún.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {[...history].reverse().map((entry) => (
                <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {entry.campoLabel}
                        </span>
                        <span className="text-xs text-gray-500">por <strong>{entry.userName}</strong></span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-red-50 rounded p-2">
                          <p className="text-xs font-semibold text-red-600 mb-1">Anterior</p>
                          <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-line">
                            {entry.valorAnterior || <em className="text-gray-400">vacío</em>}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded p-2">
                          <p className="text-xs font-semibold text-green-600 mb-1">Nuevo</p>
                          <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-line">
                            {entry.valorNuevo || <em className="text-gray-400">vacío</em>}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{timeFmt(entry.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar — secciones */}
        <div className="lg:col-span-1">
          <nav className="bg-white rounded-xl border border-gray-200 shadow overflow-hidden sticky top-4">
            {SECCIONES.map((sec) => {
              const dirtyEnSec = TEMPLATE_FIELDS.filter(
                (f) => f.seccion === sec && diff(draft[f.id], texts[f.id])
              ).length;
              return (
                <button
                  key={sec}
                  onClick={() => setSeccionAbierta(sec)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors ${
                    seccionAbierta === sec
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{SECCION_ICONS[sec] || "📝"} {sec}</span>
                  {dirtyEnSec > 0 && (
                    <span className="text-xs bg-amber-400 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                      {dirtyEnSec}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Campos */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow p-6">
            <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
              {SECCION_ICONS[seccionAbierta] || "📝"} {seccionAbierta}
            </h3>
            <div className="space-y-5">
              {camposEnSeccion.map((campo) => {
                const isDirty = diff(draft[campo.id], texts[campo.id]);
                return (
                  <div key={campo.id}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                        {campo.label}
                        {isDirty && (
                          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5">
                            Modificado
                          </span>
                        )}
                      </label>
                      {isDirty && (
                        <button
                          onClick={() => handleDiscardField(campo.id)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ↩ Descartar
                        </button>
                      )}
                    </div>
                    {campo.tipo === "textarea" ? (
                      <textarea
                        rows={campo.id.includes("Ans") || campo.id.includes("Notas") ? 4 : 3}
                        value={draft[campo.id] || ""}
                        onChange={(e) => handleChange(campo.id, e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y transition-colors ${
                          isDirty ? "border-amber-300 bg-amber-50" : "border-gray-300"
                        }`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={draft[campo.id] || ""}
                        onChange={(e) => handleChange(campo.id, e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                          isDirty ? "border-amber-300 bg-amber-50" : "border-gray-300"
                        }`}
                      />
                    )}
                    {/* Diff hint */}
                    {isDirty && texts[campo.id] && (
                      <details className="mt-1">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                          Ver texto anterior
                        </summary>
                        <p className="text-xs text-red-500 bg-red-50 rounded p-2 mt-1 whitespace-pre-line border border-red-100">
                          {texts[campo.id]}
                        </p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
