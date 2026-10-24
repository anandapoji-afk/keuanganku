import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  MM,
  PAGE_W_MM,
  PAGE_H_MM,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  CONTENT_H_FULL,
  ensurePaginated,
  getSegments,
  type Segment,
} from './paginate';

const CAPTURE_SCALE = 2.5;
const JPEG_QUALITY = 0.92;

interface Job {
  el: HTMLElement;
  /** null = ambil seluruh elemen (halaman lampiran). */
  seg: Segment | null;
}

async function waitImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          })
    )
  );
}

function hideNoPrint(doc: Document) {
  doc.querySelectorAll<HTMLElement>('.no-print').forEach((el) => {
    el.style.display = 'none';
  });
}

export async function downloadElementAsPdf(
  container: HTMLElement,
  filename: string,
  onProgress?: (done: number, total: number) => void
) {
  const doc = container.ownerDocument;
  try {
    await doc.fonts?.ready;
  } catch {
    /* abaikan */
  }

  const pageEls = Array.from(container.querySelectorAll<HTMLElement>('.report-page'));
  const targets = pageEls.length > 0 ? pageEls : [container];
  await Promise.all(targets.map(waitImages));

  // Halaman utama dipaginasi persis seperti pratinjau; lampiran = 1 halaman per elemen.
  const jobs: Job[] = [];
  const firstPass = targets.map((el) => {
    if (!el.hasAttribute('data-paginate')) return { el, segs: null as Segment[] | null };
    ensurePaginated(el, undefined);
    return { el, segs: getSegments(el) };
  });

  for (const p of firstPass) {
    if (!p.segs) {
      jobs.push({ el: p.el, seg: null });
      continue;
    }
    for (const s of p.segs) {
      // Jaga-jaga: potongan lebih tinggi dari area isi dipecah rata.
      const h = s.bottom - s.top;
      if (h <= CONTENT_H_FULL + 1) {
        jobs.push({ el: p.el, seg: s });
      } else {
        for (let y = s.top; y < s.bottom - 1; y += CONTENT_H_FULL) {
          jobs.push({ el: p.el, seg: { top: y, bottom: Math.min(s.bottom, y + CONTENT_H_FULL) } });
        }
      }
    }
  }
  const total = jobs.length;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  for (let i = 0; i < jobs.length; i++) {
    const { el, seg } = jobs[i];
    onProgress?.(i, total);

    if (i > 0) pdf.addPage('a4', 'portrait');

    if (seg) {
      const cs = (doc.defaultView || window).getComputedStyle(el);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const contentW = el.getBoundingClientRect().width - padL - padR;
      const h = seg.bottom - seg.top;

      const canvas = await html2canvas(el, {
        scale: CAPTURE_SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        x: padL,
        y: seg.top,
        width: contentW,
        height: h,
        onclone: (d: Document) => hideNoPrint(d),
      });

      const wMm = contentW / MM;
      const hMm = h / MM;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', JPEG_QUALITY),
        'JPEG',
        padL / MM,
        MARGIN_TOP_MM,
        wMm,
        hMm,
        undefined,
        'FAST'
      );
      canvas.width = 0;
      canvas.height = 0;
    } else {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        onclone: (d: Document) => hideNoPrint(d),
      });
      // Pertahankan rasio; kecilkan jika lebih tinggi dari A4.
      let wMm = PAGE_W_MM;
      let hMm = (canvas.height / canvas.width) * PAGE_W_MM;
      if (hMm > PAGE_H_MM) {
        const k = PAGE_H_MM / hMm;
        wMm *= k;
        hMm = PAGE_H_MM;
      }
      pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', (PAGE_W_MM - wMm) / 2, 0, wMm, hMm, undefined, 'FAST');
      canvas.width = 0;
      canvas.height = 0;
    }

    // Nomor halaman di margin bawah.
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`KeuanganKu · Halaman ${i + 1} dari ${jobs.length}`, PAGE_W_MM - 12, PAGE_H_MM - (MARGIN_BOTTOM_MM - 6), {
      align: 'right',
    });
  }

  onProgress?.(jobs.length, total);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
