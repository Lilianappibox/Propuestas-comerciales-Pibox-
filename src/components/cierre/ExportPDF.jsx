import { useRef, useState } from "react";
import html2pdf from "html2pdf.js";

export default function ExportPDF({ targetId, mes }) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    const el = document.getElementById(targetId);
    if (!el) return;

    html2pdf()
      .set({
        margin: [8, 6, 8, 6],
        filename: `Cierre-Comercial-Pibox-${mes.replace(" ", "-")}.pdf`,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 1.5, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(el)
      .save()
      .then(() => setLoading(false));
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-bold text-sm shadow hover:shadow-lg transition disabled:opacity-60"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Generando PDF...
        </>
      ) : (
        <>📄 Descargar PDF</>
      )}
    </button>
  );
}
