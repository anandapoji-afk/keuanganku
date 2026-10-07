import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function downloadElementAsPdf(container: HTMLElement, filename: string) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pages = container.querySelectorAll<HTMLElement>('.report-page');
  const targetElements = pages.length > 0 ? Array.from(pages) : [container];

  for (let i = 0; i < targetElements.length; i++) {
    const pageEl = targetElements[i];

    // Sembunyikan elemen no-print selama konversi
    const noPrintElements = pageEl.querySelectorAll<HTMLElement>('.no-print');
    noPrintElements.forEach((el) => {
      el.style.display = 'none';
    });

    const canvas = await html2canvas(pageEl, {
      scale: 2, // High resolution (300dpi equivalent)
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    // Pulihkan elemen no-print
    noPrintElements.forEach((el) => {
      el.style.removeProperty('display');
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }
    // A4 dimensions: 210mm x 297mm
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
