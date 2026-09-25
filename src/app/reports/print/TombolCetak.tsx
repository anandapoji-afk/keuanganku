'use client';

export default function TombolCetak() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print fixed top-4 right-4 z-50 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-sky-700"
    >
      Cetak / Simpan sebagai PDF
    </button>
  );
}
