"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfPageProps = {
  document: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  fitWidth: boolean;
  onVisible: (pageNumber: number) => void;
};

function PdfPage({ document, pageNumber, scale, fitWidth, onVisible }: PdfPageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) onVisible(pageNumber);
    }, { rootMargin: "700px 0px" });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [onVisible, pageNumber]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    const render = async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled || !canvasRef.current || !frameRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const width = frameRef.current.clientWidth;
        const pageScale = fitWidth ? Math.max(0.5, Math.min(3, width / baseViewport.width)) : scale;
        const viewport = page.getViewport({ scale: pageScale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas rendering is unavailable.");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({ canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && (renderError as { name?: string })?.name !== "RenderingCancelledException") setError(true);
      }
    };
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, fitWidth, pageNumber, scale, visible]);

  return <div ref={frameRef} className="pdf-page" aria-label={`PDF page ${pageNumber}`}>
    <canvas ref={canvasRef} aria-hidden="true" />
    {!visible && <span className="pdf-page-placeholder">Page {pageNumber}</span>}
    {error && <p className="pdf-page-error">This page could not be rendered. Use the download link below to open the original PDF.</p>}
  </div>;
}

export function PdfReader({ url, title }: { url: string; title: string }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [fitWidth, setFitWidth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let loadingTask: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | undefined;
    setLoading(true);
    setError("");
    void import("pdfjs-dist").then(async ({ getDocument, GlobalWorkerOptions }) => {
      GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      loadingTask = getDocument({ url });
      const loaded = await loadingTask.promise;
      if (disposed) { await loaded.destroy(); return; }
      setDocument(loaded);
      setPageCount(loaded.numPages);
      setCurrentPage(1);
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (!disposed) { setError(loadError instanceof Error ? loadError.message : "The PDF could not be loaded."); setLoading(false); }
    });
    return () => {
      disposed = true;
      void loadingTask?.destroy();
      setDocument(null);
    };
  }, [url]);

  const goToPage = (page: number) => {
    const nextPage = Math.max(1, Math.min(pageCount || 1, Math.round(page) || 1));
    setCurrentPage(nextPage);
    pageRefs.current.get(nextPage)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") { event.preventDefault(); goToPage(currentPage + 1); }
    if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goToPage(currentPage - 1); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setFitWidth(false); setScale((value) => Math.min(3, value + 0.15)); }
    if (event.key === "-") { event.preventDefault(); setFitWidth(false); setScale((value) => Math.max(0.5, value - 0.15)); }
  };

  return <section className="pdf-reader" aria-label={`${title} PDF reader`} tabIndex={0} onKeyDown={onKeyDown}>
    <div className="pdf-reader-toolbar">
      <div className="pdf-reader-page-control"><button type="button" className="pill" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous PDF page">←</button><label>Page <input type="number" min={1} max={pageCount || 1} value={currentPage} onChange={(event) => goToPage(Number(event.target.value))} aria-label="Current PDF page"/> <span>of {pageCount || "—"}</span></label><button type="button" className="pill" onClick={() => goToPage(currentPage + 1)} disabled={!pageCount || currentPage >= pageCount} aria-label="Next PDF page">→</button></div>
      <div className="pdf-reader-actions"><button type="button" className="pill" onClick={() => { setFitWidth(false); setScale((value) => Math.min(3, value + 0.15)); }}>Zoom in</button><button type="button" className="pill" onClick={() => { setFitWidth(false); setScale((value) => Math.max(0.5, value - 0.15)); }}>Zoom out</button><button type="button" className="pill" aria-pressed={fitWidth} onClick={() => setFitWidth((value) => !value)}>{fitWidth ? "Fit width" : "Actual size"}</button><a className="pill" href={url} download target="_blank" rel="noreferrer">Download PDF</a></div>
    </div>
    <p className="pdf-reader-hint">Use ← → or Page Up/Page Down to turn pages. Press + or − to zoom.</p>
    {loading && <p className="pdf-reader-state" role="status">Loading PDF…</p>}
    {error && <div className="pdf-reader-state pdf-reader-error" role="alert"><p>We couldn’t render this PDF in the custom reader.</p><a className="pill" href={url} target="_blank" rel="noreferrer">Open PDF separately</a><span className="field-hint">{error}</span></div>}
    {!loading && !error && document && <div ref={viewerRef} className="pdf-reader-pages">{Array.from({ length: pageCount }, (_, index) => { const pageNumber = index + 1; return <div key={pageNumber} ref={(element) => { if (element) pageRefs.current.set(pageNumber, element); else pageRefs.current.delete(pageNumber); }}><PdfPage document={document} pageNumber={pageNumber} scale={scale} fitWidth={fitWidth} onVisible={setCurrentPage}/></div>; })}</div>}
  </section>;
}
