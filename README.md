# 📦 PIBOX — Tablero Comercial

Herramienta interna para el equipo comercial de **Digital Platforms Colombia SAS (PIBOX)**.
Permite crear, personalizar y exportar propuestas comerciales de forma modular.

## 🚀 Funcionalidades principales

- **Propuestas modulares**: selecciona qué servicios incluir (On Demand, Programado, Picarga, Storage, ADN Tecnológico, T&C, Cobertura)
- **Datos del cliente**: empresa, contacto, correo, ciudad libre, fecha
- **Exportar a PDF y Word** con formato profesional PIBOX
- **Mis Propuestas**: guarda, carga, duplica y gestiona el estado de cada propuesta
- **Tarifario editable**: Admin puede editar tarifas, agregar/eliminar ciudades por módulo
- **Editor de Plantilla**: edita todos los textos estándar con historial de cambios
- **Gestión de Usuarios**: roles KAM y Administrativo con permisos diferenciados
- **Firma del KAM**: los datos del usuario logueado aparecen automáticamente en el cierre y aceptación

## ⚙️ Stack

React 19 + Vite | Tailwind CSS v4 | docx | file-saver | localStorage

## 📦 Instalación

```bash
git clone https://github.com/TU_USUARIO/pibox-propuestas.git
cd pibox-propuestas
npm install
npm run dev        # http://localhost:5173
npm run build      # Build producción
```

## 🔐 Credenciales por defecto

| Email | Contraseña | Rol |
|---|---|---|
| admin@pibox.app | pibox2026 | Administrativo |
| kam@pibox.app | kam2026 | KAM |

> ⚠️ Cambia las contraseñas desde 👥 Usuarios antes de usar en producción.

## 🛡️ Roles y Permisos

| Permiso | KAM | Admin |
|---|:---:|:---:|
| Crear/exportar propuestas | ✅ | ✅ |
| Guardar propuestas | ✅ | ✅ |
| Ver propuestas de otros | ❌ | ✅ |
| Editar tarifas | ❌ | ✅ |
| Editar plantilla + historial | ❌ | ✅ |
| Gestionar usuarios | ❌ | ✅ |

## 📁 Estructura

```
src/
├── components/
│   ├── Login.jsx
│   ├── PropuestaPreview.jsx
│   ├── PropuestasSaved.jsx
│   ├── TarifasEditor.jsx
│   ├── TemplateEditor.jsx
│   └── UserManager.jsx
├── data/
│   ├── tarifas.js
│   ├── templateTexts.js
│   └── users.js
├── utils/
│   ├── exportWord.js
│   └── formatCurrency.js
├── App.jsx
└── index.css
```

Digital Platforms Colombia SAS © 2026
