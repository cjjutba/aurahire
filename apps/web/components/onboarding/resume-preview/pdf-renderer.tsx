"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextItem,
} from "pdfjs-dist/types/src/display/api";
import type { TextLayerItem } from "./find-text-spans";

if (typeof window !== "undefined") {
  // Worker URL — bundled by Next.js's webpack via import.meta.url.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

interface Props {
  url: string;
  /** Called once after all pages render with the flat list of text items per page. */
  onTextLayer: (pages: TextLayerItem[][]) => void;
  onLoadError: (err: Error) => void;
  className?: string;
}

export function PdfRenderer({ url, onTextLayer, onLoadError, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdfjs.getDocument(url).promise.then(
      (d) => {
        if (!cancelled) setDoc(d);
      },
      (err) => {
        if (!cancelled) onLoadError(err as Error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, onLoadError]);

  useEffect(() => {
    if (!doc || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";
    let cancelled = false;
    const allTextItems: TextLayerItem[][] = [];

    (async () => {
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        if (cancelled) return;
        const page: PDFPageProxy = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const pageWrapper = document.createElement("div");
        pageWrapper.style.position = "relative";
        pageWrapper.style.marginBottom = "16px";
        pageWrapper.style.width = `${viewport.width}px`;
        pageWrapper.style.height = `${viewport.height}px`;
        pageWrapper.style.backgroundColor = "white";
        pageWrapper.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
        pageWrapper.dataset.pageIndex = String(pageNum - 1);

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        pageWrapper.appendChild(canvas);

        const textLayerDiv = document.createElement("div");
        textLayerDiv.style.position = "absolute";
        textLayerDiv.style.top = "0";
        textLayerDiv.style.left = "0";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.pointerEvents = "none";
        textLayerDiv.dataset.pageNum = String(pageNum);
        textLayerDiv.classList.add("textLayer");
        pageWrapper.appendChild(textLayerDiv);

        const textContent = await page.getTextContent();
        const items: TextLayerItem[] = textContent.items
          .filter((it): it is TextItem => "str" in it)
          .map((it) => {
            const tx = pdfjs.Util.transform(viewport.transform, it.transform);
            return {
              str: it.str,
              x: tx[4],
              y: tx[5] - it.height,
              width: it.width,
              height: it.height,
            };
          });
        allTextItems.push(items);

        // Render text layer DOM.
        for (const it of textContent.items) {
          if (!("str" in it)) continue;
          const textItem = it as TextItem;
          const tx = pdfjs.Util.transform(viewport.transform, textItem.transform);
          const span = document.createElement("span");
          span.textContent = textItem.str;
          span.style.position = "absolute";
          span.style.left = `${tx[4]}px`;
          span.style.top = `${tx[5] - textItem.height}px`;
          span.style.fontSize = `${textItem.height}px`;
          span.style.color = "transparent";
          span.style.whiteSpace = "pre";
          textLayerDiv.appendChild(span);
        }

        container.appendChild(pageWrapper);
      }

      if (!cancelled) onTextLayer(allTextItems);
    })().catch((err) => {
      if (!cancelled) onLoadError(err as Error);
    });

    return () => {
      cancelled = true;
    };
  }, [doc, onTextLayer, onLoadError]);

  return <div ref={containerRef} className={className} />;
}
