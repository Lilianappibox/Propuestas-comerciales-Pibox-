export default function ManualUsuario() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📖</span>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-tight">Manual de Usuario</h1>
            <p className="text-xs text-gray-500">Tablero Comercial Pibox — comercial.picap.io</p>
          </div>
        </div>
        <a
          href="/manual.html"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: "#FF6B00" }}
        >
          <span>↗</span> Abrir en nueva pestaña
        </a>
      </div>

      {/* iframe con el manual */}
      <iframe
        src="/manual.html"
        title="Manual de Usuario Pibox"
        className="flex-1 w-full border-0"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
