"use client";

import { cn } from "@webcampus/ui/lib/utils";
import { Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface HallTicketPreviewProps<T = Record<string, unknown>> {
  data: T | null;
  renderDocument: (data: T) => React.ReactNode;
  pageWidth?: number;
  pageClassName?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  empty?: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function HallTicketPreview<T>({
  data,
  renderDocument,
  pageWidth = 900,
  pageClassName,
  showHeader = true,
  showFooter = true,
  loading = false,
  error,
  empty,
  title = "Preview",
  actions,
}: HallTicketPreviewProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const calculateScale = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.offsetWidth;
    setScale(Math.min(1, w / pageWidth));
  }, [pageWidth]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(calculateScale)
    );
    return () => cancelAnimationFrame(raf);
  }, [calculateScale]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(calculateScale, 16);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [calculateScale]);

  const needsScaling = scale < 1;

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col">
      {showHeader && (
        <div className="bg-background sticky top-0 z-10 flex items-center border-b px-4 py-3 md:px-6">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden p-4 md:p-6">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading...
          </div>
        ) : error ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {error}
          </div>
        ) : data ? (
          <div className={cn("flex flex-col items-center", pageClassName)}>
            {needsScaling ? (
              <div
                className="shrink-0"
                style={{ width: `${pageWidth * scale}px` }}
              >
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    width: `${pageWidth}px`,
                  }}
                >
                  {renderDocument(data)}
                </div>
              </div>
            ) : (
              renderDocument(data)
            )}
            {needsScaling && scale < 0.6 && (
              <p className="text-muted-foreground mt-4 text-center text-xs">
                Pinch to zoom for better readability
              </p>
            )}
          </div>
        ) : empty ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {empty}
          </div>
        ) : null}
      </div>

      {showFooter && actions && (
        <div className="bg-background sticky bottom-0 z-10 flex min-h-[52px] flex-wrap items-center justify-end gap-3 border-t px-4 py-3 md:px-6">
          {actions}
        </div>
      )}
    </div>
  );
}
