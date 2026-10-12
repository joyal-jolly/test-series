import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

// ─── Tool constants ────────────────────────────────────────────────────────────
const T = {
  PEN: 'pen',
  HIGHLIGHTER: 'highlighter',
  UNDERLINE: 'underline',
  STRIKETHROUGH: 'strikethrough',
  CIRCLE: 'circle',
  RECT: 'rect',
  TEXT: 'text',
  COMMENT: 'comment',
  ERASER: 'eraser',
};

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#1f2937',
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Draw one annotation onto a canvas ────────────────────────────────────────
function drawAnnotation(ctx, a, W, H) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = a.color || '#ef4444';
  ctx.fillStyle = a.color || '#ef4444';
  ctx.lineWidth = a.thickness || 2;

  switch (a.type) {
    case T.PEN: {
      if (!a.pts?.length) break;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(a.pts[0].x * W, a.pts[0].y * H);
      for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x * W, a.pts[i].y * H);
      ctx.stroke();
      break;
    }
    case T.HIGHLIGHTER: {
      if (!a.pts?.length) break;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = (a.thickness || 2) * 8;
      ctx.beginPath();
      ctx.moveTo(a.pts[0].x * W, a.pts[0].y * H);
      for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x * W, a.pts[i].y * H);
      ctx.stroke();
      break;
    }
    case T.UNDERLINE:
    case T.STRIKETHROUGH: {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(a.x1 * W, a.y1 * H);
      ctx.lineTo(a.x2 * W, a.y2 * H);
      ctx.stroke();
      break;
    }
    case T.RECT: {
      ctx.globalAlpha = 1;
      ctx.strokeRect(a.x * W, a.y * H, a.w * W, a.h * H);
      break;
    }
    case T.CIRCLE: {
      ctx.globalAlpha = 1;
      const cx = (a.x + a.w / 2) * W;
      const cy = (a.y + a.h / 2) * H;
      const rx = Math.abs((a.w * W) / 2);
      const ry = Math.abs((a.h * H) / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, 2 * Math.PI);
      ctx.stroke();
      break;
    }
    case T.TEXT: {
      ctx.globalAlpha = 1;
      const fs = a.fs || 15;
      ctx.font = `${fs}px 'Source Sans 3', sans-serif`;
      ctx.fillStyle = a.color;
      a.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, a.x * W, a.y * H + i * fs * 1.35);
      });
      break;
    }
    case T.COMMENT: {
      ctx.globalAlpha = 1;
      const px = a.x * W;
      const py = a.y * H;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - 5, py + 9);
      ctx.lineTo(px, py + 22);
      ctx.lineTo(px + 5, py + 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(a.num || '!'), px, py - 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ─── Build a preview from an in-progress stroke ────────────────────────────────
function buildPreview(s, ex, ey) {
  switch (s.type) {
    case T.PEN: case T.HIGHLIGHTER: return { ...s };
    case T.UNDERLINE: {
      const ly = Math.max(s.sy, ey) + 0.013;
      return { ...s, x1: s.sx, y1: ly, x2: ex, y2: ly };
    }
    case T.STRIKETHROUGH: {
      const ly = (s.sy + ey) / 2;
      return { ...s, x1: s.sx, y1: ly, x2: ex, y2: ly };
    }
    case T.RECT: case T.CIRCLE:
      return { ...s, x: s.sx, y: s.sy, w: ex - s.sx, h: ey - s.sy };
    default: return null;
  }
}

// ─── PDFAnnotator Component ────────────────────────────────────────────────────
// Renders ALL pages in a continuous scrollable column. No page-by-page navigation.
export default function PDFAnnotator({ pdfUrl }) {
  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Tool state
  const [tool, setTool] = useState(T.PEN);
  const [color, setColor] = useState('#ef4444');
  const [thickness, setThickness] = useState(3);

  // Annotation state: { [pageNum]: [...annotations] }
  const [annots, setAnnots] = useState({});
  const [undos, setUndos] = useState([]);
  const [redos, setRedos] = useState([]);

  // Overlay input (text / comment pin)
  const [overlay, setOverlay] = useState(null); // { type, x, y, nx, ny, pn }
  const overlayValRef = useRef('');

  // Refs to avoid stale closures in pointer handlers
  const toolRef = useRef(T.PEN);
  const colorRef = useRef('#ef4444');
  const thicknessRef = useRef(3);
  const scaleRef = useRef(1.3);
  const annotsRef = useRef({});
  const undosRef = useRef([]);
  const redosRef = useRef([]);
  const isDown = useRef(false);
  const activeRef = useRef(null); // in-progress stroke
  const activePageRef = useRef(1);

  // Per-page canvas refs
  const pdfCanvasRefs = useRef({}); // { [pn]: HTMLCanvasElement }
  const annotCanvasRefs = useRef({}); // { [pn]: HTMLCanvasElement }

  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const pdfDocRef = useRef(null);

  // Sync refs with state
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { annotsRef.current = annots; }, [annots]);
  useEffect(() => { undosRef.current = undos; }, [undos]);
  useEffect(() => { redosRef.current = redos; }, [redos]);

  // ── Load PDF ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfUrl) { setPdfError('No PDF provided.'); setPdfLoading(false); return; }
    setPdfLoading(true);
    setPdfError('');
    setNumPages(0);
    setAnnots({});
    setUndos([]);
    setRedos([]);
    annotsRef.current = {};
    // Clear old canvas refs
    pdfCanvasRefs.current = {};
    annotCanvasRefs.current = {};

    const task = pdfjsLib.getDocument({ url: pdfUrl });
    task.promise
      .then((doc) => {
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setPdfLoading(false);
      })
      .catch((err) => {
        setPdfError(`Could not load PDF: ${err?.message || 'Unknown error'}`);
        setPdfLoading(false);
      });
    return () => { try { task.destroy(); } catch { /* ignore */ } };
  }, [pdfUrl]);

  // ── Draw annotations for a specific page ──────────────────────────────────────
  const drawAnnotsForPage = useCallback((pn) => {
    const canvas = annotCanvasRefs.current[pn];
    if (!canvas || !canvas.width) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    (annotsRef.current[pn] || []).forEach((a) => drawAnnotation(ctx, a, W, H));
  }, []);

  // ── Render a single page to its canvases ──────────────────────────────────────
  const renderOnePage = useCallback(async (doc, pn, sc) => {
    const pdfCanvas = pdfCanvasRefs.current[pn];
    const annotCanvas = annotCanvasRefs.current[pn];
    if (!pdfCanvas || !annotCanvas) return;

    try {
      const page = await doc.getPage(pn);
      const viewport = page.getViewport({ scale: sc });

      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      annotCanvas.width = viewport.width;
      annotCanvas.height = viewport.height;

      const ctx = pdfCanvas.getContext('2d', { alpha: false });
      await page.render({ canvasContext: ctx, viewport }).promise;

      drawAnnotsForPage(pn);
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page ${pn}:`, err);
      }
    }
  }, [drawAnnotsForPage]);

  // ── Render ALL pages sequentially ─────────────────────────────────────────────
  const renderAllPages = useCallback(async () => {
    const doc = pdfDocRef.current;
    if (!doc) return;
    const sc = scaleRef.current;
    for (let pn = 1; pn <= doc.numPages; pn++) {
      await renderOnePage(doc, pn, sc);
    }
  }, [renderOnePage]);

  // Trigger render after numPages or scale change (small delay so React paints the canvases first)
  useEffect(() => {
    if (!pdfLoading && numPages > 0) {
      const t = setTimeout(() => renderAllPages(), 60);
      return () => clearTimeout(t);
    }
  }, [numPages, scale, pdfLoading, renderAllPages]);

  // ── Pointer helpers ────────────────────────────────────────────────────────────
  function getCanvasPt(e, pn) {
    const c = annotCanvasRefs.current[pn];
    if (!c) return { px: 0, py: 0, nx: 0, ny: 0 };
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const sy = c.height / r.height;
    const px = (e.clientX - r.left) * sx;
    const py = (e.clientY - r.top) * sy;
    return { px, py, nx: px / c.width, ny: py / c.height };
  }

  function getDisplayPt(e, pn) {
    const c = annotCanvasRefs.current[pn];
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Pointer handlers ───────────────────────────────────────────────────────────
  function handlePointerDown(e, pn) {
    if (e.button !== undefined && e.button !== 0) return;
    const t = toolRef.current;
    activePageRef.current = pn;

    if (t === T.TEXT || t === T.COMMENT) {
      const { nx, ny } = getCanvasPt(e, pn);
      const { x, y } = getDisplayPt(e, pn);
      overlayValRef.current = '';
      setOverlay({ type: t, x, y, nx, ny, pn });
      return;
    }

    isDown.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { nx, ny } = getCanvasPt(e, pn);

    if (t === T.ERASER) {
      eraseAt(pn, nx, ny);
      return;
    }

    activeRef.current = {
      type: t, pn,
      color: colorRef.current,
      thickness: thicknessRef.current,
      pts: [{ x: nx, y: ny }],
      sx: nx, sy: ny, ex: nx, ey: ny,
    };
  }

  function handlePointerMove(e, pn) {
    if (!isDown.current) return;
    if (activePageRef.current !== pn) return;
    const t = toolRef.current;
    const { nx, ny } = getCanvasPt(e, pn);

    if (t === T.ERASER) { eraseAt(pn, nx, ny); return; }

    const s = activeRef.current;
    if (!s || s.pn !== pn) return;
    s.ex = nx; s.ey = ny;
    if (t === T.PEN || t === T.HIGHLIGHTER) s.pts.push({ x: nx, y: ny });

    // Live preview — draw directly (no React state update = no re-render)
    const c = annotCanvasRefs.current[pn];
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    (annotsRef.current[pn] || []).forEach((a) => drawAnnotation(ctx, a, W, H));
    const preview = buildPreview(s, nx, ny);
    if (preview) drawAnnotation(ctx, preview, W, H);
  }

  function handlePointerUp(e, pn) {
    if (!isDown.current) return;
    isDown.current = false;
    const t = toolRef.current;
    if (t === T.ERASER) return;

    const s = activeRef.current;
    activeRef.current = null;
    if (!s || s.pn !== pn) return;

    const { nx, ny } = getCanvasPt(e, pn);
    let newAnnot = null;

    if (t === T.PEN || t === T.HIGHLIGHTER) {
      if (s.pts.length < 2) return;
      s.pts.push({ x: nx, y: ny });
      newAnnot = { id: uid(), type: t, color: s.color, thickness: s.thickness, pts: [...s.pts] };
    } else if (t === T.UNDERLINE) {
      if (Math.abs(nx - s.sx) < 0.01) return;
      const ly = Math.max(s.sy, ny) + 0.013;
      newAnnot = { id: uid(), type: t, color: s.color, thickness: s.thickness, x1: s.sx, y1: ly, x2: nx, y2: ly };
    } else if (t === T.STRIKETHROUGH) {
      if (Math.abs(nx - s.sx) < 0.01) return;
      const ly = (s.sy + ny) / 2;
      newAnnot = { id: uid(), type: t, color: s.color, thickness: s.thickness, x1: s.sx, y1: ly, x2: nx, y2: ly };
    } else if (t === T.RECT || t === T.CIRCLE) {
      if (Math.abs(nx - s.sx) < 0.005 && Math.abs(ny - s.sy) < 0.005) return;
      newAnnot = { id: uid(), type: t, color: s.color, thickness: s.thickness, x: s.sx, y: s.sy, w: nx - s.sx, h: ny - s.sy };
    }

    if (newAnnot) commitAnnot(pn, newAnnot);
  }

  // ── Annotation management ──────────────────────────────────────────────────────
  function commitAnnot(pn, annot) {
    setAnnots((prev) => {
      const pageAnnots = prev[pn] || [];
      const next = { ...prev, [pn]: [...pageAnnots, annot] };
      setUndos((u) => { const n = [...u.slice(-49), { pn, state: prev }]; undosRef.current = n; return n; });
      setRedos(() => { redosRef.current = []; return []; });
      annotsRef.current = next;
      setTimeout(() => drawAnnotsForPage(pn), 0);
      return next;
    });
  }

  function eraseAt(pn, nx, ny) {
    const RADIUS = 0.035;
    setAnnots((prev) => {
      const pageAnnots = prev[pn] || [];
      const filtered = pageAnnots.filter((a) => {
        if (a.type === T.PEN || a.type === T.HIGHLIGHTER)
          return !a.pts.some((p) => Math.hypot(p.x - nx, p.y - ny) < RADIUS);
        if (a.type === T.RECT || a.type === T.CIRCLE)
          return Math.hypot(a.x + a.w / 2 - nx, a.y + a.h / 2 - ny) >= RADIUS * 4;
        if (a.type === T.TEXT || a.type === T.COMMENT)
          return Math.hypot(a.x - nx, a.y - ny) >= RADIUS * 3;
        if (a.type === T.UNDERLINE || a.type === T.STRIKETHROUGH)
          return Math.hypot((a.x1 + a.x2) / 2 - nx, (a.y1 + a.y2) / 2 - ny) >= RADIUS * 4;
        return true;
      });
      if (filtered.length === pageAnnots.length) return prev;
      const next = { ...prev, [pn]: filtered };
      annotsRef.current = next;
      setTimeout(() => drawAnnotsForPage(pn), 0);
      return next;
    });
  }

  function undo() {
    const stack = undosRef.current;
    if (!stack.length) return;
    const last = stack[stack.length - 1];
    const cur = annotsRef.current;
    setRedos((r) => { const n = [...r, { pn: last.pn, state: cur }]; redosRef.current = n; return n; });
    setUndos((u) => { const n = u.slice(0, -1); undosRef.current = n; return n; });
    setAnnots(() => {
      annotsRef.current = last.state;
      setTimeout(() => drawAnnotsForPage(last.pn), 0);
      return last.state;
    });
  }

  function redo() {
    const stack = redosRef.current;
    if (!stack.length) return;
    const next = stack[stack.length - 1];
    const cur = annotsRef.current;
    setUndos((u) => { const n = [...u, { pn: next.pn, state: cur }]; undosRef.current = n; return n; });
    setRedos((r) => { const n = r.slice(0, -1); redosRef.current = n; return n; });
    setAnnots(() => {
      annotsRef.current = next.state;
      setTimeout(() => drawAnnotsForPage(next.pn), 0);
      return next.state;
    });
  }

  // ── Overlay submit ─────────────────────────────────────────────────────────────
  function submitOverlay() {
    if (!overlay) return;
    const text = overlayValRef.current.trim();
    if (!text) { setOverlay(null); return; }
    const pn = overlay.pn;

    if (overlay.type === T.TEXT) {
      commitAnnot(pn, { id: uid(), type: T.TEXT, color: colorRef.current, x: overlay.nx, y: overlay.ny, text, fs: 15 });
    } else {
      const commentNum = ((annotsRef.current[pn] || []).filter((a) => a.type === T.COMMENT).length) + 1;
      commitAnnot(pn, { id: uid(), type: T.COMMENT, color: colorRef.current, x: overlay.nx, y: overlay.ny, text, num: commentNum });
    }
    setOverlay(null);
    overlayValRef.current = '';
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────────
  const undoFnRef = useRef(null);
  const redoFnRef = useRef(null);
  undoFnRef.current = undo;
  redoFnRef.current = redo;

  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoFnRef.current(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoFnRef.current(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Fullscreen ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) wrapperRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function fitWidth() {
    const container = containerRef.current;
    const firstCanvas = pdfCanvasRefs.current[1];
    if (!container || !firstCanvas) return;
    const availW = container.clientWidth - 40;
    const naturalW = firstCanvas.width / scaleRef.current;
    if (naturalW > 0) setScale(+(availW / naturalW).toFixed(2));
  }

  // ── Cursor ────────────────────────────────────────────────────────────────────
  const cursorMap = {
    [T.PEN]: 'crosshair',
    [T.HIGHLIGHTER]: 'crosshair',
    [T.UNDERLINE]: 'crosshair',
    [T.STRIKETHROUGH]: 'crosshair',
    [T.CIRCLE]: 'crosshair',
    [T.RECT]: 'crosshair',
    [T.TEXT]: 'text',
    [T.COMMENT]: 'cell',
    [T.ERASER]: 'cell',
  };

  const toolBtns = [
    { k: T.PEN,           icon: '✏️', label: 'Pen (freehand)' },
    { k: T.HIGHLIGHTER,   icon: '🖊️', label: 'Highlighter' },
    { k: T.UNDERLINE,     icon: 'U̲',  label: 'Underline' },
    { k: T.STRIKETHROUGH, icon: 'S̶',  label: 'Strikethrough' },
    { k: T.CIRCLE,        icon: '○',  label: 'Circle' },
    { k: T.RECT,          icon: '▭',  label: 'Rectangle' },
    { k: T.TEXT,          icon: 'T',  label: 'Add text' },
    { k: T.COMMENT,       icon: '📌', label: 'Comment pin' },
    { k: T.ERASER,        icon: '⌫',  label: 'Eraser' },
  ];

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className={`pdfan-root${isFullscreen ? ' pdfan-fsmode' : ''}`}>

      {/* ── Toolbar ── */}
      <div className="pdfan-toolbar">

        {/* Zoom */}
        <div className="pdfan-tg">
          <button className="pdfan-btn" onClick={() => setScale((s) => Math.max(0.4, +(s - 0.2).toFixed(1)))} title="Zoom out">−</button>
          <span className="pdfan-zoomlbl">{Math.round(scale * 100)}%</span>
          <button className="pdfan-btn" onClick={() => setScale((s) => Math.min(3.5, +(s + 0.2).toFixed(1)))} title="Zoom in">+</button>
          <button className="pdfan-btn pdfan-textbtn" onClick={fitWidth} title="Fit to width">Fit W</button>
          <button className="pdfan-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? '⤓' : '⛶'}
          </button>
        </div>

        <div className="pdfan-sep" />

        {/* Pages indicator (read-only info) */}
        {numPages > 0 && (
          <span className="pdfan-pagecount pdfan-lbl">{numPages} page{numPages !== 1 ? 's' : ''}</span>
        )}

        <div className="pdfan-sep" />

        {/* Annotation tools */}
        <div className="pdfan-tg pdfan-tools">
          {toolBtns.map(({ k, icon, label }) => (
            <button
              key={k}
              className={`pdfan-btn pdfan-toolbtn${tool === k ? ' active' : ''}`}
              onClick={() => { setTool(k); toolRef.current = k; }}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="pdfan-sep" />

        {/* Color swatches */}
        <div className="pdfan-tg pdfan-colors">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`pdfan-swatch${color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => { setColor(c); colorRef.current = c; }}
              title={c}
            />
          ))}
          <input
            type="color"
            className="pdfan-colorpicker"
            value={color}
            onChange={(e) => { setColor(e.target.value); colorRef.current = e.target.value; }}
            title="Custom colour"
          />
        </div>

        <div className="pdfan-sep" />

        {/* Thickness */}
        <div className="pdfan-tg">
          <span className="pdfan-lbl">Sz</span>
          <input
            type="range"
            className="pdfan-slider"
            min={1} max={20} value={thickness}
            onChange={(e) => { const v = +e.target.value; setThickness(v); thicknessRef.current = v; }}
          />
          <span className="pdfan-lbl pdfan-szval">{thickness}</span>
        </div>

        <div className="pdfan-sep" />

        {/* Undo / Redo */}
        <div className="pdfan-tg">
          <button className="pdfan-btn" onClick={undo} disabled={!undos.length} title="Undo (Ctrl+Z)">↩</button>
          <button className="pdfan-btn" onClick={redo} disabled={!redos.length} title="Redo (Ctrl+Y)">↪</button>
        </div>
      </div>

      {/* ── Canvas scroll area ── */}
      <div ref={containerRef} className="pdfan-canvas-area">

        {/* Loading */}
        {pdfLoading && (
          <div className="pdfan-status">
            <div className="pdfan-spinner" />
            <p>Loading PDF…</p>
          </div>
        )}

        {/* Error */}
        {!pdfLoading && pdfError && (
          <div className="pdfan-status pdfan-status--err">
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <p>{pdfError}</p>
          </div>
        )}

        {/* Continuous page column */}
        {numPages > 0 && (
          <div className="pdfan-pages-col">
            {pages.map((pn) => (
              <div key={pn} className="pdfan-page-item">
                {/* Page number badge */}
                <div className="pdfan-page-badge">Page {pn}</div>

                <div className="pdfan-canvas-wrap">
                  {/* PDF render canvas */}
                  <canvas
                    ref={(el) => { if (el) pdfCanvasRefs.current[pn] = el; }}
                    className="pdfan-pdf-canvas"
                  />

                  {/* Annotation overlay canvas */}
                  <canvas
                    ref={(el) => { if (el) annotCanvasRefs.current[pn] = el; }}
                    className="pdfan-annot-canvas"
                    style={{ cursor: cursorMap[tool] || 'crosshair' }}
                    onPointerDown={(e) => handlePointerDown(e, pn)}
                    onPointerMove={(e) => handlePointerMove(e, pn)}
                    onPointerUp={(e) => handlePointerUp(e, pn)}
                    onPointerCancel={(e) => handlePointerUp(e, pn)}
                  />

                  {/* Text / Comment input overlay for this page */}
                  {overlay && overlay.pn === pn && (
                    <div
                      className="pdfan-overlay"
                      style={{ left: overlay.x, top: overlay.y }}
                    >
                      <div className="pdfan-overlay-hd">
                        {overlay.type === T.TEXT ? '✏️ Add text' : '📌 Add comment'}
                      </div>
                      <textarea
                        autoFocus
                        rows={3}
                        className="pdfan-overlay-ta"
                        placeholder={overlay.type === T.TEXT ? 'Type annotation…' : 'Write comment…'}
                        onChange={(e) => { overlayValRef.current = e.target.value; }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitOverlay(); }
                          if (e.key === 'Escape') setOverlay(null);
                        }}
                      />
                      <div className="pdfan-overlay-actions">
                        <button
                          className="btn primary"
                          style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}
                          onClick={submitOverlay}
                        >
                          {overlay.type === T.TEXT ? 'Add' : 'Pin'}
                        </button>
                        <button
                          className="btn ghost"
                          style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}
                          onClick={() => setOverlay(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
