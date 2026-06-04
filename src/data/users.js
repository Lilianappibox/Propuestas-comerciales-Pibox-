export const ROLES = {
  KAM: "KAM",
  ADMIN: "Administrativo",
};

export const PERMISOS = {
  [ROLES.KAM]: {
    verPropuesta: true,
    verTarifario: false,
    editarTarifas: false,
    editarPlantilla: false,
    verUsuarios: false,
    gestionarUsuarios: false,
  },
  [ROLES.ADMIN]: {
    verPropuesta: true,
    verTarifario: true,
    editarTarifas: true,
    editarPlantilla: true,
    verUsuarios: true,
    gestionarUsuarios: true,
  },
};

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
  },
];

export function loadUsers() {
  try {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    if (!saved) return JSON.parse(JSON.stringify(DEFAULT_USERS));
    // Merge: ensure new fields exist on old records
    return JSON.parse(saved).map((u) => ({
      cargo: "", celular: "", telefono: "",
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
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.activo
  ) || null;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
