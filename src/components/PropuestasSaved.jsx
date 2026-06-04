import { useState } from "react";

export const SAVED_KEY = "pibox_saved_proposals";

export function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch { return []; }
}
export function storeSaved(list) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

const ESTADO_STYLES = {
  borrador: "bg-gray-100 text-gray-600 border-gray-200",
  enviada:  "bg-blue-100 text-blue-700 border-blue-200",
  aceptada: "bg-green-100 text-green-700 border-green-200",
  firmada:  "bg-purple-100 text-purple-700 border-purple-200",
};
const ESTADO_ICONS = {
  borrador: "✏️", enviada: "📤", aceptada: "✅", firmada: "🔏",
};

function dateFmt(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function PropuestasSaved({
  saved, onLoad, onDelete, onDuplicate, onEstado, currentUser,
}) {
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const filtered = saved
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        p.clienteNombre.toLowerCase().includes(q) ||
        (p.nombre || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.fechaModificacion) - new Date(a.fechaModificacion));

  const myProposals = filtered.filter((p) => p.userId === currentUser.id);
  const othersProposals = filtered.filter((p) => p.userId !== currentUser.id);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Mis Propuestas</h2>
          <p className="text-sm text-gray-500">
            {saved.filter((p) => p.userId === currentUser.id).length} propuesta(s) guardada(s)
          </p>
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar por cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
        />
      </div>

      {/* Empty state */}
      {saved.filter((p) => p.userId === currentUser.id).length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500 font-medium">No tienes propuestas guardadas</p>
          <p className="text-gray-400 text-sm mt-1">Ve a "✏️ Propuesta" y usa el botón "Guardar propuesta"</p>
        </div>
      )}

      {/* My proposals */}
      {myProposals.length > 0 && (
        <div className="space-y-3 mb-6">
          {myProposals.map((p) => (
            <ProposalCard
              key={p.id}
              p={p}
              isOwner
              onLoad={() => onLoad(p)}
              onDuplicate={() => onDuplicate(p)}
              onEstado={(estado) => onEstado(p.id, estado)}
              confirmDel={confirmDel}
              setConfirmDel={setConfirmDel}
              onDelete={() => { onDelete(p.id); setConfirmDel(null); }}
            />
          ))}
        </div>
      )}

      {/* Other users' proposals (admin sees all) */}
      {othersProposals.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            📋 Propuestas de otros usuarios
          </p>
          <div className="space-y-3">
            {othersProposals.map((p) => (
              <ProposalCard
                key={p.id}
                p={p}
                isOwner={false}
                onLoad={() => onLoad(p)}
                onDuplicate={() => onDuplicate(p)}
                onEstado={(estado) => onEstado(p.id, estado)}
                confirmDel={confirmDel}
                setConfirmDel={setConfirmDel}
                onDelete={() => { onDelete(p.id); setConfirmDel(null); }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalCard({ p, isOwner, onLoad, onDuplicate, onEstado, confirmDel, setConfirmDel, onDelete }) {
  const [showEstado, setShowEstado] = useState(false);
  const estados = ["borrador", "enviada", "aceptada", "firmada"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-4">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center shrink-0">
        {(p.clienteNombre || "?").charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-gray-800">{p.clienteNombre || "Sin nombre"}</span>
          <div className="relative">
            <button
              onClick={() => setShowEstado(!showEstado)}
              className={`text-xs px-2 py-0.5 rounded-full border font-medium cursor-pointer hover:opacity-80 ${ESTADO_STYLES[p.estado]}`}
            >
              {ESTADO_ICONS[p.estado]} {p.estado}
            </button>
            {showEstado && (
              <div className="absolute top-6 left-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-max">
                {estados.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onEstado(e); setShowEstado(false); }}
                    className={`w-full text-left text-xs px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2 ${p.estado === e ? "font-semibold" : ""}`}
                  >
                    {ESTADO_ICONS[e]} {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isOwner && (
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              👤 {p.userName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          {p.ciudadCliente && <span>📍 {p.ciudadCliente}</span>}
          <span>📅 Creada: {dateFmt(p.fechaCreacion)}</span>
          <span>✏️ Modificada: {dateFmt(p.fechaModificacion)}</span>
        </div>
        {p.modulosLabel && (
          <p className="text-xs text-gray-500 mt-1 truncate">Módulos: {p.modulosLabel}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          onClick={onLoad}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 transition-colors font-medium"
        >
          📂 Cargar
        </button>
        <button
          onClick={onDuplicate}
          className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          📋 Duplicar
        </button>
        {isOwner && (
          confirmDel === p.id ? (
            <div className="flex gap-1">
              <button onClick={onDelete} className="text-xs bg-red-600 text-white rounded px-2 py-1.5">Confirmar</button>
              <button onClick={() => setConfirmDel(null)} className="text-xs border rounded px-2 py-1.5">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(p.id)}
              className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
            >
              🗑️
            </button>
          )
        )}
      </div>
    </div>
  );
}
