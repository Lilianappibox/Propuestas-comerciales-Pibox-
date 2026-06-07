export default function ExportPDF({ mes, onPrint }) {
  const handleExport = () => {
    if (onPrint) onPrint();
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-bold text-sm shadow hover:shadow-lg transition"
    >
      📄 Descargar PDF
    </button>
  );
}
