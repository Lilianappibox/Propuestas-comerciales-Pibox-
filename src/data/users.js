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
    verInformeCruzVerde: false,
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
    verInformeCruzVerde: false,
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
    verInformeCruzVerde: true,
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
  { id: "verInformeCruzVerde", label: "Ver Informe Cruz Verde",     desc: "Puede acceder al informe operacional de Cruz Verde" },
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
