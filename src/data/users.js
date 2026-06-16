export const ROLES = {
  KAM: "KAM",
  ADMIN: "Administrativo",
  OPERATIVO: "Operativo",
};

// Permisos base por rol
export const PERMISOS_BASE = {
  [ROLES.KAM]: {
    verPropuesta:        true,
    verTarifario:        false,
    editarTarifas:       false,
    editarPlantilla:     false,
    verUsuarios:         false,
    gestionarUsuarios:   false,
    verCierreComercial:  false,
    verRiesgoComercial:  false,
    verInformeTada:      false,
  },
  [ROLES.OPERATIVO]: {
    verPropuesta:        false,
    verTarifario:        false,
    editarTarifas:       false,
    editarPlantilla:     false,
    verUsuarios:         false,
    gestionarUsuarios:   false,
    verCierreComercial:  false,
    verRiesgoComercial:  false,
    verInformeTada:      false,
  },
  [ROLES.ADMIN]: {
    verPropuesta:        true,
    verTarifario:        true,
    editarTarifas:       true,
    editarPlantilla:     true,
    verUsuarios:         true,
    gestionarUsuarios:   true,
    verCierreComercial:  true,
    verRiesgoComercial:  true,
    verInformeTada:      true,
  },
};

// Permisos que el Admin PUEDE activar/desactivar para KAM y Operativo
export const PERMISOS_CONFIGURABLES = [
  { id: "verPropuesta",        label: "Ver Propuestas Comerciales", desc: "Puede acceder al módulo de propuestas" },
  { id: "verTarifario",        label: "Ver Tarifario Pibox",        desc: "Puede acceder al Tarifario Pibox" },
  { id: "editarTarifas",       label: "Editar tarifas",             desc: "Puede modificar precios y ciudades" },
  { id: "editarPlantilla",     label: "Editar plantilla",           desc: "Puede editar los textos estándar y ver historial" },
  { id: "verCierreComercial",  label: "Ver Cierre Comercial",       desc: "Puede acceder al tablero de cierre mensual" },
  { id: "verRiesgoComercial",  label: "Ver Riesgo Comercial 360°",  desc: "Puede acceder al tablero de riesgo de clientes" },
  { id: "verInformeTada",      label: "Ver Informe TaDa",           desc: "Puede acceder al informe operacional TaDa (Bavaria)" },
];

// Backward compatibility
export const PERMISOS_CONFIGURABLES_KAM = PERMISOS_CONFIGURABLES;

/**
 * Resuelve los permisos efectivos de un usuario:
 * - Admin → siempre permisos completos
 * - KAM / Operativo → base del rol fusionado con permisos personalizados
 */
export function getPermisos(user) {
  if (!user) return {};
  if (user.rol === ROLES.ADMIN) return { ...PERMISOS_BASE[ROLES.ADMIN] };
  const base = PERMISOS_BASE[user.rol] || PERMISOS_BASE[ROLES.OPERATIVO];
  return {
    ...base,
    ...(user.permisosCustom || {}),
  };
}

export const USERS_STORAGE_KEY = "pibox_users";
const CLOUD_URL = "https://jsonblob.com/api/jsonBlob/019ece00-2e0c-7418-95ca-af282305d9a4";

// ── Sincronización con la nube ────────────────────────────────────────────
export async function fetchCloudUsers() {
  try {
    const res = await fetch(CLOUD_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.users || []).map(u => ({ cargo: "", celular: "", telefono: "", permisosCustom: {}, ...u }));
  } catch { return null; }
}

export async function saveCloudUsers(users) {
  try {
    await fetch(CLOUD_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users }),
    });
  } catch { /* silencioso */ }
}

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
    permisosCustom: { verTarifario: true, editarTarifas: true, verCierreComercial: true, verRiesgoComercial: true },
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
    permisosCustom: { verTarifario: true, editarTarifas: true, verCierreComercial: true, verRiesgoComercial: true },
  },
  {
    id: "4",
    nombre: "Anderson Perez",
    email: "aperez@pibox.app",
    password: "pibox2026",
    rol: ROLES.OPERATIVO,
    activo: true,
    cargo: "Coordinador Tada",
    celular: "",
    telefono: "",
    permisosCustom: { verInformeTada: true, verRiesgoComercial: true },
  },
  {
    id: "5",
    nombre: "Oscar González",
    email: "ogonzalez@pibox.app",
    password: "pibox2026",
    rol: ROLES.OPERATIVO,
    activo: true,
    cargo: "",
    celular: "",
    telefono: "",
    permisosCustom: { verInformeTada: true, verRiesgoComercial: true, verTarifario: true },
  },
  {
    id: "6",
    nombre: "Maria Paula Rincón",
    email: "mrincon@pibox.app",
    password: "pibox2026",
    rol: ROLES.OPERATIVO,
    activo: true,
    cargo: "",
    celular: "",
    telefono: "",
    permisosCustom: { verInformeTada: true, verRiesgoComercial: true, verTarifario: true },
  },
  {
    id: "7",
    nombre: "Camilo Romero",
    email: "cromero@pibox.app",
    password: "pibox2026",
    rol: ROLES.OPERATIVO,
    activo: true,
    cargo: "",
    celular: "",
    telefono: "",
    permisosCustom: { verInformeTada: true, verRiesgoComercial: true, verTarifario: true },
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
    const merged = [...base];
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
