// Paginasi laporan A4 — satu sumber kebenaran untuk Pratinjau, Cetak, dan Unduh PDF.
//
// Cara kerja:
// 1. Ukur semua blok yang tidak boleh terpotong (baris tabel, judul bagian,
//    header kategori, kotak total, dll).
// 2. Pilih titik potong di antara blok sehingga tiap halaman muat dalam area
//    isi A4 (297mm - margin atas - margin bawah).
// 3. Sisipkan elemen pemisah `[data-page-gap]` di titik potong. Di layar
//    pemisah tampil sebagai batas halaman. Saat cetak ia jadi page-break.
// 4. generatePdf.ts memotong gambar tepat di antara pemisah yang sama,
//    jadi hasil PDF == pratinjau == hasil cetak.

export const MM = 96 / 25.4; // px per mm (CSS)
export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;
export const MARGIN_TOP_MM = 12;
export const MARGIN_BOTTOM_MM = 14;
export const MARGIN_X_MM = 12;

/** Tinggi area isi satu halaman (px), tanpa cadangan. */
export const CONTENT_H_FULL = (PAGE_H_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM;
/** Tinggi area isi yang dipakai menghitung potongan (cadangan kecil agar cetak tidak meluap). */
const CONTENT_H = Math.floor(CONTENT_H_FULL) - 8;

const GAP_BAND_PX = 14;

interface Block {
  top: number;
  bottom: number;
  first: HTMLElement;
}

interface Split {
  orig: HTMLTableSectionElement;
  extra: HTMLTableElement;
}

interface State {
  done: boolean;
  spacers: HTMLElement[];
  splits: Split[];
  colgroups: HTMLElement[];
  tables: HTMLTableElement[];
  stripped: HTMLElement[];
  totalPages: number;
}

const states = new WeakMap<HTMLElement, State>();

const KEEP_NEXT = '.sect-title, .grp-head, tr.thead-mini';
const ATOM_SEL = '.sect-title, .grp-head, tr.thead-mini, tr.data-row, .total-row, .saldo-box, .page-foot, .avoid-break';

function win(el: HTMLElement): Window & typeof globalThis {
  return (el.ownerDocument.defaultView || window) as Window & typeof globalThis;
}

export function resetPagination(page: HTMLElement) {
  const st = states.get(page);
  if (!st) return;
  for (let i = st.splits.length - 1; i >= 0; i--) {
    const { orig, extra } = st.splits[i];
    const extraBody = extra.tBodies[0];
    if (extraBody) {
      while (extraBody.firstChild) orig.appendChild(extraBody.firstChild);
    }
    extra.remove();
  }
  st.spacers.forEach((s) => s.remove());
  st.colgroups.forEach((c) => c.remove());
  st.tables.forEach((t) => t.style.removeProperty('table-layout'));
  st.stripped.forEach((g) => g.classList.add('avoid-break'));
  states.delete(page);
}

export function isPaginated(page: HTMLElement) {
  return states.get(page)?.done === true;
}

export function totalPagesOf(page: HTMLElement) {
  return states.get(page)?.totalPages ?? 1;
}

/** Idempotent: kalau sudah dipaginasi, tidak melakukan apa-apa. Return jumlah halaman isi utama. */
export function ensurePaginated(page: HTMLElement, totalDocPages?: number): number {
  const existing = states.get(page);
  if (existing?.done) return existing.spacers.length + 1;
  return paginate(page, totalDocPages);
}

function paginate(page: HTMLElement, totalDocPages?: number): number {
  resetPagination(page);
  const doc = page.ownerDocument;
  const w = win(page);

  const st: State = { done: false, spacers: [], splits: [], colgroups: [], tables: [], stripped: [], totalPages: 1 };

  // 1) Kunci lebar kolom supaya tabel yang dipecah tetap sejajar.
  Array.from(page.querySelectorAll<HTMLTableElement>('table.data')).forEach((t) => {
    const headCells = t.querySelectorAll<HTMLElement>('thead tr:first-child td');
    const tableW = t.getBoundingClientRect().width;
    if (!headCells.length || !tableW) return;
    const cg = doc.createElement('colgroup');
    headCells.forEach((td) => {
      const col = doc.createElement('col');
      col.style.width = ((td.getBoundingClientRect().width / tableW) * 100).toFixed(3) + '%';
      cg.appendChild(col);
    });
    t.insertBefore(cg, t.firstChild);
    t.style.tableLayout = 'fixed';
    st.colgroups.push(cg);
    st.tables.push(t);
  });

  // 2) Ukur.
  const pageRect = page.getBoundingClientRect();
  const cs = w.getComputedStyle(page);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const rel = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - pageRect.top, bottom: r.bottom - pageRect.top };
  };

  const candidates = Array.from(page.querySelectorAll<HTMLElement>(ATOM_SEL)).filter(
    (el) => !(el.matches('.avoid-break') && !el.matches('tr') && el.querySelector('.avoid-break, tr'))
  );
  const set = new Set(candidates);
  const atoms = candidates.filter((el) => {
    let p = el.parentElement;
    while (p && p !== page) {
      if (set.has(p)) return false;
      p = p.parentElement;
    }
    return true;
  });

  // Gabungkan judul dengan elemen sesudahnya (keep-with-next).
  const blocks: Block[] = [];
  let pend: Block | null = null;
  for (const el of atoms) {
    const r = rel(el);
    if (pend) {
      pend.bottom = r.bottom;
    } else {
      pend = { top: r.top, bottom: r.bottom, first: el };
    }
    if (el.matches(KEEP_NEXT)) continue;
    blocks.push(pend);
    pend = null;
  }
  if (pend) blocks.push(pend);

  // Grup kategori kecil: usahakan utuh dalam satu halaman.
  Array.from(page.querySelectorAll<HTMLElement>('.avoid-break')).forEach((g) => {
    if (g.matches('tr') || !g.querySelector('tr')) return;
    const r = rel(g);
    if (r.bottom - r.top <= CONTENT_H * 0.4) blocks.push({ top: r.top, bottom: r.bottom, first: g });
  });

  blocks.sort((a, b) => a.top - b.top);

  const last = page.lastElementChild as HTMLElement | null;
  const contentBottom = last ? rel(last).bottom : pageRect.height;

  // 3) Tentukan titik potong.
  const breaks: { block: Block; segLen: number }[] = [];
  let start = padTop;
  let guard = 0;
  while (contentBottom - start > CONTENT_H && guard++ < 500) {
    const limit = start + CONTENT_H;
    let chosen: Block | null = null;
    let fallback: Block | null = null;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const c = blocks[i];
      if (c.top <= start + 24) break; // tidak boleh membuat halaman kosong
      if (c.top > limit) continue;
      if (!fallback) fallback = c;
      let straddle = false;
      for (const b of blocks) {
        if (b.top < c.top - 0.5 && b.bottom > c.top + 0.5) {
          straddle = true;
          break;
        }
      }
      if (!straddle) {
        chosen = c;
        break;
      }
    }
    const pick = chosen || fallback;
    if (!pick) break;
    breaks.push({ block: pick, segLen: pick.top - start });
    start = pick.top;
  }

  const mainPages = breaks.length + 1;
  const total = totalDocPages ?? mainPages + Math.max(0, doc.querySelectorAll('.report-page').length - 1);

  // 4) Sisipkan pemisah.
  breaks.forEach((br, idx) => {
    const remaining = Math.max(0, CONTENT_H_FULL - br.segLen);
    const hA = remaining + MARGIN_BOTTOM_MM * MM;
    const hC = MARGIN_TOP_MM * MM;

    const sp = doc.createElement('div');
    sp.className = 'page-gap';
    sp.setAttribute('data-page-gap', String(idx + 1));
    sp.style.cssText = `height:${hA + GAP_BAND_PX + hC}px;margin:0 -${MARGIN_X_MM}mm;position:relative;`;
    sp.innerHTML =
      `<div style="height:${hA}px;position:relative;background:#fff">` +
      `<span style="position:absolute;right:${MARGIN_X_MM}mm;bottom:5mm;font-size:9px;color:#94a3b8">KeuanganKu · Halaman ${idx + 1} dari ${total}</span></div>` +
      `<div style="height:${GAP_BAND_PX}px;background:#e2e8f0;box-shadow:inset 0 3px 4px -3px rgba(0,0,0,.18),inset 0 -3px 4px -3px rgba(0,0,0,.18)"></div>` +
      `<div style="height:${hC}px;background:#fff"></div>`;

    insertGapBefore(br.block.first, sp, st);
    st.spacers.push(sp);
  });

  st.done = true;
  st.totalPages = total;
  states.set(page, st);
  return mainPages;
}

function insertGapBefore(first: HTMLElement, gap: HTMLElement, st: State) {
  // Lepas avoid-break dari pembungkus grup supaya break paksa di dalamnya tidak bentrok.
  let anc = first.parentElement;
  while (anc && !anc.classList.contains('report-page')) {
    if (anc.classList.contains('avoid-break') && !anc.matches('tr')) {
      anc.classList.remove('avoid-break');
      st.stripped.push(anc);
    }
    anc = anc.parentElement;
  }

  if (first.tagName === 'TR') {
    const section = first.parentElement as HTMLTableSectionElement;
    const table = section.parentElement as HTMLTableElement;
    const isFirstInTable = section.tagName === 'THEAD' || first === section.firstElementChild;
    if (isFirstInTable) {
      table.parentElement!.insertBefore(gap, table);
      return;
    }
    // Pecah tabel di sini: baris ini dan sesudahnya pindah ke tabel baru.
    const extra = table.cloneNode(false) as HTMLTableElement;
    const cg = table.querySelector('colgroup');
    if (cg) extra.appendChild(cg.cloneNode(true));
    const body = first.ownerDocument.createElement('tbody');
    extra.appendChild(body);
    let node: Element | null = first;
    while (node) {
      const next: Element | null = node.nextElementSibling;
      body.appendChild(node);
      node = next;
    }
    table.parentElement!.insertBefore(gap, table.nextSibling);
    gap.after(extra);
    st.splits.push({ orig: section, extra });
    return;
  }

  first.parentElement!.insertBefore(gap, first);
}

export interface Segment {
  top: number;
  bottom: number;
}

/** Potongan isi per halaman (px, relatif ke atas elemen halaman), berdasarkan pemisah yang ada. */
export function getSegments(page: HTMLElement): Segment[] {
  const pageRect = page.getBoundingClientRect();
  const padTop = parseFloat(win(page).getComputedStyle(page).paddingTop) || 0;
  const segs: Segment[] = [];
  let start = padTop;
  page.querySelectorAll<HTMLElement>('[data-page-gap]').forEach((s) => {
    const r = s.getBoundingClientRect();
    segs.push({ top: start, bottom: r.top - pageRect.top });
    start = r.bottom - pageRect.top;
  });
  const last = page.lastElementChild as HTMLElement | null;
  const end = last ? last.getBoundingClientRect().bottom - pageRect.top : pageRect.height;
  segs.push({ top: start, bottom: Math.max(start + 1, end) });
  return segs;
}
