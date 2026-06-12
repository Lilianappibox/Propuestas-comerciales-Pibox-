export const ROLES = {
  KAM: "KAM",
  ADMIN: "Administrativo",
};

// Permisos base por rol — el Admin nunca cambia
export const PERMISOS_BASE = {
  [ROLES.KAM]: {
    verPropuesta:        true,
    verTarifario:        false,
    editarTarifas:       false,
    editarPlantilla:     false,
    verUsuarios:         false,
    gestionarUsuarios:   false,
    verCierreComercial:  false,
    verRiesgoComercial:  false,  // el Admin lo activa por KAM
  },
  [ROLES.ADMIN]: {
    verPropuesta:        true,
    verTarifario:        true,
    editarTarifas:       true,
    editarPlantilla:     true,
    verUsuarios:         true,
    gestionarUsuarios:   true,
    verCierreComercial:  true,
    verRiesgoComercial:  true,   // Admin siempre puede verlo
  },
};

// Permisos que el Admin PUEDE activar/desactivar para un KAM
export const PERMISOS_CONFIGURABLES_KAM = [
  { id: "verTarifario",       label: "Ver tarifario",              desc: "Puede ver las tablas de tarifas" },
  { id: "editarTarifas",      label: "Editar tarifas",             desc: "Puede modificar precios y ciudades" },
  { id: "editarPlantilla",    label: "Editar plantilla",           desc: "Puede editar los textos estándar y ver historial" },
  { id: "verCierreComercial",  label: "Ver Cierre Comercial",         desc: "Puede acceder al tablero de cierre mensual" },
  { id: "verRiesgoComercial",  label: "Ver Riesgo Comercial 360°",   desc: "Puede acceder al tablero de riesgo de clientes" },
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
    nombre: "Liliana Andrea Peña",
    email: "lpena@pibox.app",
    password: "pibox2026",
    rol: ROLES.ADMIN,
    activo: true,
    cargo: "Head of Sales",
    celular: "3107872609",
    telefono: "",
    permisosCustom: {},
  },
  {
    id: "2",
    nombre: "Jaime Girón",
    email: "jgiron@pibox.app",
    password: "KAM2026",
    rol: ROLES.KAM,
    activo: true,
    cargo: "Key Account Manager",
    celular: "3154051883",
    telefono: "",
    permisosCustom: { verTarifario: true, editarTarifas: true, verCierreComercial: true },
  },
  {
    id: "3",
    nombre: "Juliana Rojas",
    email: "jrojas@pibox.app",
    password: "KAM2026",
    rol: ROLES.KAM,
    activo: true,
    cargo: "Key Account Manager",
    celular: "3232278047",
    telefono: "",
    permisosCustom: { verTarifario: true, editarTarifas: true, verCierreComercial: true },
  },
];

export function loadUsers() {
  try {
    const base = JSON.parse(JSON.stringify(DEFAULT_USERS));
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    if (!saved) return base;
    const local = JSON.parse(saved).map((u) => ({
      cargo: "", celular: "", telefono: "", permisosCustom: {},
      ...u,
    }));
    // Merge: los del código siempre presentes (localStorage puede editarlos),
    // más cualquier usuario adicional creado desde la app
    const merged = [...base];
    const baseEmails = new Set(base.map((u) => u.email.toLowerCase()));
    // Sobreescribir datos del código con ediciones del localStorage
    // permisosCustom se fusiona: código + localStorage (código tiene prioridad en nuevos permisos)
    for (const lu of local) {
      const idx = merged.findIndex((m) => m.email.toLowerCase() === lu.email.toLowerCase());
      if (idx >= 0) {
        const basePermisos = merged[idx].permisosCustom || {};
        const localPermisos = lu.permisosCustom || {};
        merged[idx] = { ...merged[idx], ...lu, permisosCustom: { ...localPermisos, ...basePermisos } };
      } else {
        merged.push(lu);
      }
    }
    return merged;
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
           u.password.toLowerCase() === password.toLowerCase() && u.activo
  ) || null;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
