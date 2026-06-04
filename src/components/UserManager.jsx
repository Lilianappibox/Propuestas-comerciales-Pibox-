import { useState } from "react";
import { ROLES, generateId } from "../data/users";

const ROLE_COLORS = {
  [ROLES.ADMIN]: "bg-purple-100 text-purple-700 border-purple-200",
  [ROLES.KAM]: "bg-blue-100 text-blue-700 border-blue-200",
};

const ROLE_ICONS = {
  [ROLES.ADMIN]: "🛡️",
  [ROLES.KAM]: "💼",
};

export default function UserManager({ users, onSave }) {
  const [editing, setEditing] = useState(null); // null | "new" | user.id
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: ROLES.KAM, activo: true });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const openNew = () => {
    setForm({ nombre: "", email: "", password: "", rol: ROLES.KAM, activo: true, cargo: "", celular: "", telefono: "" });
    setError("");
    setShowPass(false);
    setEditing("new");
  };

  const openEdit = (user) => {
    setForm({ cargo: "", celular: "", telefono: "", ...user });
    setError("");
    setShowPass(false);
    setEditing(user.id);
  };

  const handleSave = () => {
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    // Check duplicate email
    const dup = users.find(
      (u) => u.email.toLowerCase() === form.email.toLowerCase() && u.id !== editing
    );
    if (dup) {
      setError("Ya existe un usuario con ese correo.");
      return;
    }

    let updated;
    if (editing === "new") {
      updated = [...users, { ...form, id: generateId() }];
    } else {
      updated = users.map((u) => (u.id === editing ? { ...form } : u));
    }
    onSave(updated);
    setEditing(null);
  };

  const handleToggleActive = (id) => {
    const updated = users.map((u) =>
      u.id === id ? { ...u, activo: !u.activo } : u
    );
    onSave(updated);
  };

  const handleDelete = (id) => {
    const updated = users.filter((u) => u.id !== id);
    onSave(updated);
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-500">{users.length} usuario(s) registrado(s)</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <span>+</span> Nuevo usuario
        </button>
      </div>

      {/* User list */}
      <div className="space-y-3 mb-6">
        {users.map((user) => (
          <div
            key={user.id}
            className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${
              !user.activo ? "opacity-60" : ""
            }`}
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    Inactivo
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{user.email}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => openEdit(user)}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
              >
                Editar
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
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-xs bg-red-600 text-white rounded-lg px-2 py-1.5 hover:bg-red-700"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(user.id)}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Role legend */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Permisos por Rol</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              rol: ROLES.KAM,
              permisos: ["✅ Crear y editar propuestas", "✅ Seleccionar módulos", "✅ Exportar PDF y Word", "❌ Editar tarifas", "❌ Gestionar usuarios"],
            },
            {
              rol: ROLES.ADMIN,
              permisos: ["✅ Crear y editar propuestas", "✅ Seleccionar módulos", "✅ Exportar PDF y Word", "✅ Editar tarifas", "✅ Gestionar usuarios"],
            },
          ].map(({ rol, permisos }) => (
            <div key={rol} className="bg-white rounded-lg border p-3">
              <p className={`text-xs font-bold mb-2 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${ROLE_COLORS[rol]}`}>
                {ROLE_ICONS[rol]} {rol}
              </p>
              <ul className="space-y-1">
                {permisos.map((p, i) => (
                  <li key={i} className="text-xs text-gray-600">{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Modal / Form */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editing === "new" ? "Nuevo usuario" : "Editar usuario"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre completo *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ej: Carlos Rodríguez"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Correo electrónico *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="carlos@pibox.app"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showPass ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Cargo</label>
                  <input
                    type="text"
                    value={form.cargo || ""}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Ej: KAM"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Celular</label>
                  <input
                    type="text"
                    value={form.celular || ""}
                    onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="+57 300..."
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Rol *</label>
                <div className="flex gap-3">
                  {Object.values(ROLES).map((r) => (
                    <label
                      key={r}
                      className={`flex-1 flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-all ${
                        form.rol === r
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rol"
                        value={r}
                        checked={form.rol === r}
                        onChange={() => setForm((f) => ({ ...f, rol: r }))}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium">{ROLE_ICONS[r]} {r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">Usuario activo</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              >
                {editing === "new" ? "Crear usuario" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
