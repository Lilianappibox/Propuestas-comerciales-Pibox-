import { useState } from "react";
import { ROLES, generateId, PERMISOS_CONFIGURABLES_KAM, PERMISOS_BASE, getPermisos } from "../data/users";

const BRAND = "linear-gradient(135deg,#7C22D4,#C026D3)";
const PURPLE = "#7C22D4";

const ROLE_COLORS = {
  [ROLES.ADMIN]: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  [ROLES.KAM]:   "bg-purple-100 text-purple-700 border-purple-200",
};
const ROLE_ICONS = { [ROLES.ADMIN]: "🛡️", [ROLES.KAM]: "💼" };

const Field = ({ label, required, children }) => (
  <div>
    <label className="text-xs font-semibold text-gray-500 mb-1 block uppercase tracking-wide">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50 focus:bg-white transition-colors";

export default function UserManager({ users, onSave }) {
  const [editing, setEditing] = useState(null);   // null | "new" | user.id
  const [form, setForm]       = useState({});
  const [showPass, setShowPass] = useState(false);
  const [error, setError]      = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const blank = { nombre: "", email: "", password: "", rol: ROLES.KAM, activo: true, cargo: "", celular: "", telefono: "", permisosCustom: {} };

  const openNew  = () => { setForm(blank); setError(""); setShowPass(false); setEditing("new"); };
  const openEdit = (u) => { setForm({ ...blank, ...u }); setError(""); setShowPass(false); setEditing(u.id); };
  const cancel   = () => { setEditing(null); setError(""); };

  const togglePermiso = (id) => {
    const base    = PERMISOS_BASE[ROLES.KAM][id];
    const current = form.permisosCustom?.[id] ?? base;
    setForm((f) => ({ ...f, permisosCustom: { ...(f.permisosCustom || {}), [id]: !current } }));
  };

  const handleSave = () => {
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Nombre, correo y contraseña son obligatorios.");
      return;
    }
    const dup = users.find((u) => u.email.toLowerCase() === form.email.toLowerCase() && u.id !== editing);
    if (dup) { setError("Ya existe un usuario con ese correo."); return; }
    const updated = editing === "new"
      ? [...users, { ...form, id: generateId() }]
      : users.map((u) => (u.id === editing ? { ...form } : u));
    onSave(updated);
    cancel();
  };

  const handleToggleActive = (id) => {
    onSave(users.map((u) => u.id === id ? { ...u, activo: !u.activo } : u));
  };

  const handleDelete = (id) => {
    onSave(users.filter((u) => u.id !== id));
    setConfirmDelete(null);
  };

  const isEditing = editing !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      {/* ── COLUMNA IZQUIERDA: lista de usuarios ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Gestión de Usuarios</h2>
            <p className="text-sm text-gray-500">{users.length} usuario(s)</p>
          </div>
          <button
            onClick={openNew}
            className="text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            style={{ background: BRAND }}
          >
            + Nuevo usuario
          </button>
        </div>

        <div className="space-y-3">
          {users.map((user) => {
            const isActive = editing === user.id;
            return (
              <div
                key={user.id}
                className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
                  !user.activo ? "opacity-60" : ""
                } ${isActive ? "ring-2 ring-purple-400 border-purple-300" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                    style={{ background: BRAND }}
                  >
                    {user.nombre.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{user.nombre}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[user.rol]}`}>
                        {ROLE_ICONS[user.rol]} {user.rol}
                      </span>
                      {!user.activo && (
                        <span className="text-xs bg-gray-100 text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    {user.cargo && <p className="text-xs text-gray-400">{user.cargo}</p>}

                    {/* Permisos activos KAM */}
                    {user.rol === ROLES.KAM && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {PERMISOS_CONFIGURABLES_KAM.filter((p) => getPermisos(user)[p.id]).map((p) => (
                          <span key={p.id} className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                            ✓ {p.label}
                          </span>
                        ))}
                        {!PERMISOS_CONFIGURABLES_KAM.some((p) => getPermisos(user)[p.id]) && (
                          <span className="text-xs text-gray-400 italic">Sin permisos adicionales</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => isActive ? cancel() : openEdit(user)}
                    className={`flex-1 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                      isActive
                        ? "bg-purple-50 text-purple-700 border-purple-300"
                        : "text-purple-600 border-purple-200 hover:bg-purple-50"
                    }`}
                  >
                    {isActive ? "✏️ Editando…" : "✏️ Editar"}
                  </button>
                  <button
                    onClick={() => handleToggleActive(user.id)}
                    className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                      user.activo
                        ? "text-orange-600 border-orange-200 hover:bg-orange-50"
                        : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}
                  >
                    {user.activo ? "Desactivar" : "Activar"}
                  </button>
                  {confirmDelete === user.id ? (
                    <>
                      <button onClick={() => handleDelete(user.id)} className="text-xs bg-red-600 text-white rounded-lg px-2 py-1.5 hover:bg-red-700">
                        Confirmar
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(user.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Leyenda de permisos */}
        <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Permisos por Rol</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg border p-3">
              <p className={`text-xs font-bold mb-2 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${ROLE_COLORS[ROLES.KAM]}`}>
                {ROLE_ICONS[ROLES.KAM]} KAM
              </p>
              <ul className="space-y-1 mb-2 text-xs text-gray-600">
                <li>✅ Crear y exportar propuestas</li>
                <li>✅ Guardar propuestas</li>
              </ul>
              <p className="text-xs font-semibold text-purple-600 mb-1">🔑 Configurables:</p>
              {PERMISOS_CONFIGURABLES_KAM.map((p) => (
                <p key={p.id} className="text-xs text-gray-500">• {p.label}</p>
              ))}
            </div>
            <div className="bg-white rounded-lg border p-3">
              <p className={`text-xs font-bold mb-2 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${ROLE_COLORS[ROLES.ADMIN]}`}>
                {ROLE_ICONS[ROLES.ADMIN]} Administrativo
              </p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>✅ Acceso completo</li>
                <li>✅ Editar tarifas y plantilla</li>
                <li>✅ Ver propuestas de todos</li>
                <li>✅ Gestionar usuarios</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── COLUMNA DERECHA: formulario de edición ── */}
      <div className="lg:sticky lg:top-4">
        {!isEditing ? (
          /* Placeholder cuando no hay selección */
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-gray-500 font-medium text-sm">Selecciona un usuario para editar</p>
            <p className="text-gray-400 text-xs mt-1">o crea uno nuevo con el botón de arriba</p>
          </div>
        ) : (
          /* Formulario */
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">

            {/* Header del formulario */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: BRAND }}>
              <div>
                <h3 className="text-white font-bold text-base">
                  {editing === "new" ? "➕ Nuevo usuario" : `✏️ Editando: ${form.nombre || "usuario"}`}
                </h3>
                <p className="text-white/70 text-xs mt-0.5">Todos los campos marcados con * son obligatorios</p>
              </div>
              <button onClick={cancel} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="p-5 space-y-5">

              {/* ── Fila 1: Nombre + Email ── */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre completo" required>
                  <input type="text" value={form.nombre} placeholder="Ej: Carlos Rodríguez"
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Correo electrónico" required>
                  <input type="email" value={form.email} placeholder="carlos@pibox.app"
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>

              {/* ── Fila 2: Contraseña + Cargo ── */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contraseña" required>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.password} placeholder="Mínimo 6 caracteres"
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className={`${inputCls} pr-14`}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium">
                      {showPass ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </Field>
                <Field label="Cargo">
                  <input type="text" value={form.cargo || ""} placeholder="Ej: KAM"
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>

              {/* ── Fila 3: Celular + Teléfono ── */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Celular">
                  <input type="text" value={form.celular || ""} placeholder="+57 300..."
                    onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Teléfono">
                  <input type="text" value={form.telefono || ""} placeholder="Fijo opcional"
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>

              {/* ── Fila 4: Rol + Estado ── */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rol" required>
                  <div className="flex flex-col gap-2">
                    {Object.values(ROLES).map((r) => (
                      <label key={r}
                        className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-all text-sm ${
                          form.rol === r ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                        }`}>
                        <input type="radio" name="rol" value={r} checked={form.rol === r}
                          onChange={() => setForm((f) => ({ ...f, rol: r }))} className="accent-purple-600" />
                        <span className="font-medium">{ROLE_ICONS[r]} {r}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Estado">
                  <label className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                    form.activo ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}>
                    <input type="checkbox" checked={form.activo}
                      onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                      className="accent-green-600 w-4 h-4" />
                    <span className={`text-sm font-medium ${form.activo ? "text-green-700" : "text-gray-500"}`}>
                      {form.activo ? "✅ Activo" : "⛔ Inactivo"}
                    </span>
                  </label>
                </Field>
              </div>

              {/* ── Permisos KAM ── */}
              {form.rol === ROLES.KAM && (
                <div className="border border-purple-200 rounded-xl p-4 bg-purple-50">
                  <p className="text-xs font-bold text-purple-800 mb-3">🔑 Permisos adicionales para este KAM</p>
                  <div className="space-y-2">
                    {PERMISOS_CONFIGURABLES_KAM.map((p) => {
                      const current = form.permisosCustom?.[p.id] ?? PERMISOS_BASE[ROLES.KAM][p.id];
                      return (
                        <label key={p.id}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                            current ? "bg-white border-purple-300" : "bg-purple-50 border-purple-200 hover:border-purple-300"
                          }`}>
                          <input type="checkbox" checked={current} onChange={() => togglePermiso(p.id)}
                            className="mt-0.5 accent-purple-600" />
                          <div>
                            <p className={`text-sm font-semibold ${current ? "text-purple-700" : "text-gray-500"}`}>
                              {current ? "✅" : "🔒"} {p.label}
                            </p>
                            <p className="text-xs text-gray-400">{p.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.rol === ROLES.ADMIN && (
                <div className="border border-fuchsia-200 rounded-xl p-3 bg-fuchsia-50">
                  <p className="text-xs text-fuchsia-700 font-medium">
                    🛡️ El Administrativo tiene acceso completo. Los permisos no son configurables para este rol.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                  ⚠️ {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-1">
                <button onClick={cancel}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave}
                  className="flex-1 text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity shadow"
                  style={{ background: BRAND }}>
                  {editing === "new" ? "✓ Crear usuario" : "✓ Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
