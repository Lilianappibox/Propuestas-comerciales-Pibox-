import { useState, useRef } from "react";

const BRAND = "linear-gradient(135deg,#7C22D4,#C026D3)";

// Todas las claves de localStorage que maneja la app (borradores personales)
const STORAGE_KEYS = [
  "pibox_tarifas",
  "pibox_template",
  "pibox_template_history",
  "pibox_saved_proposals",
  "pibox_propuesta_draft",
  "pibox_modulos_draft",
];

export default function SyncData() {
  const [importStatus, setImportStatus] = useState(null); // null | "ok" | "error"
  const [importMsg, setImportMsg]       = useState("");
  const fileRef = useRef(null);

  /* ── EXPORTAR ── */
  const handleExport = () => {
    const data = {};
    STORAGE_KEYS.forEach((k) => {
      const val = localStorage.getItem(k);
      if (val) data[k] = JSON.parse(val);
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `pibox-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── IMPORTAR ── */
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let count = 0;
        STORAGE_KEYS.forEach((k) => {
          if (data[k] !== undefined) {
            localStorage.setItem(k, JSON.stringify(data[k]));
            count++;
          }
        });
        setImportStatus("ok");
        setImportMsg(`✓ ${count} conjuntos de datos restaurados. Recarga la página para ver los cambios.`);
      } catch {
        setImportStatus("error");
        setImportMsg("El archivo no es válido. Usa un backup generado por esta misma app.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset input
  };

  const handleReload = () => window.location.reload();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Sincronización de Datos</h2>
        <p className="text-sm text-gray-500 mt-1">
          Transfiere usuarios, tarifas, plantilla y propuestas entre dispositivos o entornos (localhost ↔ producción).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── EXPORTAR ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xl"
              style={{ background: BRAND }}>
              ⬇️
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Exportar datos</h3>
              <p className="text-xs text-gray-500">Descarga un backup de este dispositivo</p>
            </div>
          </div>

          <div className="space-y-2 mb-5">
            {[
              "👥 Usuarios y contraseñas",
              "💰 Tarifas configuradas",
              "📝 Plantilla comercial e historial",
              "📁 Propuestas guardadas",
              "⚙️ Módulos y borradores",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-500">✓</span> {item}
              </div>
            ))}
          </div>

          <button
            onClick={handleExport}
            className="w-full text-white font-semibold rounded-lg px-4 py-2.5 hover:opacity-90 transition-opacity"
            style={{ background: BRAND }}
          >
            ⬇️ Descargar backup (.json)
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Guarda el archivo y úsalo para importar en otro dispositivo o entorno
          </p>
        </div>

        {/* ── IMPORTAR ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xl"
              style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>
              ⬆️
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Importar datos</h3>
              <p className="text-xs text-gray-500">Restaura un backup en este dispositivo</p>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center mb-4 hover:border-purple-300 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}>
            <p className="text-3xl mb-2">📂</p>
            <p className="text-sm font-medium text-gray-600">Clic para seleccionar el archivo</p>
            <p className="text-xs text-gray-400 mt-1">pibox-backup-YYYY-MM-DD.json</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          {importStatus === "ok" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-green-700 font-medium">{importMsg}</p>
              <button
                onClick={handleReload}
                className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              >
                🔄 Recargar ahora
              </button>
            </div>
          )}

          {importStatus === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{importMsg}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
            <p className="text-xs text-amber-700">
              ⚠️ <strong>Importante:</strong> La importación reemplaza todos los datos actuales de este dispositivo.
            </p>
          </div>
        </div>
      </div>

      {/* ── Instrucciones ── */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-700 mb-3 text-sm">📋 ¿Cómo pasar datos de localhost a producción?</h3>
        <ol className="space-y-2">
          {[
            "Abre el tablero en tu localhost (donde tienes los datos).",
            "Ve a 👥 Usuarios → Sincronización → Exportar datos → descarga el archivo .json.",
            "Abre el tablero en producción (Render).",
            "Ve a 👥 Usuarios → Sincronización → Importar datos → selecciona el archivo.",
            "Haz clic en 'Recargar ahora'. ¡Listo!",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-600">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                style={{ background: BRAND }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
