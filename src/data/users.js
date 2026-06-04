export const ROLES = {
  KAM: "KAM",
  ADMIN: "Administrativo",
};

// Permisos base por rol — el Admin nunca cambia
export const PERMISOS_BASE = {
  [ROLES.KAM]: {
    verPropuesta:      true,
    verTarifario:      false,
    editarTarifas:     false,
    editarPlantilla:   false,
    verUsuarios:       false,
    gestionarUsuarios: false,
  },
  [ROLES.ADMIN]: {
    verPropuesta:      true,
    verTarifario:      true,
    editarTarifas:     true,
    editarPlantilla:   true,
    verUsuarios:       true,
    gestionarUsuarios: true,
  },
};

// Permisos que el Admin PUEDE activar/desactivar para un KAM
export const PERMISOS_CONFIGURABLES_KAM = [
  { id: "verTarifario",    label: "Ver tarifario",             desc: "Puede ver las tablas de tarifas" },
  { id: "editarTarifas",   label: "Editar tarifas",            desc: "Puede modificar precios y ciudades" },
  { id: "editarPlantilla", label: "Editar plantilla",          desc: "Puede editar los textos estándar y ver historial" },
];

/**
 * Resuelve los permisos efectivos de un usuario:
 * - Admin → siempre permisos completos
 * - KAM  → base KAM fusionado con sus permisos personalizados
 */
export function getPermisos(user) {
  if (!user) return {};
  if (user.rol === ROLES.ADMIN) return { ...PERMISOS_BASE[ROLES.ADMIN] };
  // KAM: aplica overrides guardados en user.permisosCustom
  return {
    ...PERMISOS_BASE[ROLES.KAM],
    ...(user.permisosCustom || {}),
  };
}

export const USERS_STORAGE_KEY = "pibox_users";

export const DEFAULT_USERS = [
  {
    id: "1",
    nombre: "Admin PIBOX",
    email: "admin@pibox.app",
    password: "pibox2026",
    rol: ROLES.ADMIN,
    activo: true,
    cargo: "Administrador",
    celular: "",
    telefono: "",
    permisosCustom: {},
  },
  {
    id: "2",
    nombre: "KAM Ejemplo",
    email: "kam@pibox.app",
    password: "kam2026",
    rol: ROLES.KAM,
    activo: true,
    cargo: "Key Account Manager",
    celular: "",
    telefono: "",
    permisosCustom: {},
  },
];

export function loadUsers() {
  try {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    if (!saved) return JSON.parse(JSON.stringify(DEFAULT_USERS));
    return JSON.parse(saved).map((u) => ({
      cargo: "", celular: "", telefono: "", permisosCustom: {},
      ...u,
    }));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_USERS));
  }
}

export function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function authenticate(users, email, password) {
  return users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() &&
           u.password === password && u.activo
  ) || null;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
