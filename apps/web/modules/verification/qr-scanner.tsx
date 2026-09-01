"use client";

import { Button } from "@webcampus/ui/components/button";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeFullConfig,
} from "html5-qrcode";
import { Camera, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  onResult: (text: string) => void;
  busy?: boolean;
}

export function QrScanner({ onResult, busy }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flash, setFlash] = useState(false);

  const fullConfig: Html5QrcodeFullConfig = {
    formatsToSupport: undefined,
    useBarCodeDetectorIfSupported: false,
    experimentalFeatures: undefined,
    verbose: false,
  };

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          void scanner.stop().catch(() => {});
        } catch {
          // ignore
        }
        try {
          scanner.clear();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  function triggerFlash() {
    setFlash(true);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlash(false), 500);
  }

  function clearFlash() {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlash(false);
  }

  async function stopScanner() {
    startingRef.current = false;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // ignore
      }
      try {
        scanner.clear();
      } catch {
        // ignore
      }
    }
    setScanning(false);
  }

  function newScanner(): Html5Qrcode | null {
    if (!containerRef.current) return null;
    return new Html5Qrcode("verification-qr-scanner", fullConfig);
  }

  async function startScanner() {
    setError(null);
    clearFlash();
    if (startingRef.current) return;
    try {
      await stopScanner();
      startingRef.current = true;
      const scanner = newScanner();
      if (!scanner) {
        setError("Scanner container not found");
        return;
      }
      scannerRef.current = scanner;
      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
      };
      await scanner.start(
        { facingMode: "environment" },
        scanConfig,
        (decodedText) => {
          triggerFlash();
          void stopScanner();
          onResult(decodedText);
        },
        () => {
          // intermediate decode — ignore
        }
      );
      startingRef.current = false;
      setScanning(true);
    } catch (err) {
      startingRef.current = false;
      scannerRef.current = null;
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start camera. Check camera permissions."
      );
      setScanning(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await stopScanner();
      const scanner = newScanner();
      if (!scanner) {
        setError("Scanner container not found");
        return;
      }
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, false);
      scannerRef.current = null;
      scanner.clear();
      triggerFlash();
      onResult(decoded);
    } catch (err) {
      scannerRef.current = null;
      setError(
        err instanceof Error
          ? err.message
          : "Could not decode a QR code from that image."
      );
    }
  }

  async function handleManualSubmit() {
    const value = manualValue.trim();
    if (!value) return;
    onResult(value);
    setManualValue("");
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* html5-qrcode owns this element's DOM — React must never render
            children into it or reconciliation will fight the library's
            injected <video>. */}
        <div
          ref={containerRef}
          id="verification-qr-scanner"
          className={`bg-muted flex h-64 overflow-hidden rounded-lg border transition-shadow ${
            flash ? "ring-2 ring-emerald-500" : ""
          }`}
        />
        {!scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-sm">
              <ScanLine className="size-8" />
              <span>Camera preview appears here</span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={scanning ? "outline" : "default"}
          size="sm"
          onClick={
            scanning ? () => void stopScanner() : () => void startScanner()
          }
          disabled={busy}
        >
          {scanning ? (
            <X className="mr-2 size-4" />
          ) : (
            <Camera className="mr-2 size-4" />
          )}
          {scanning ? "Stop Camera" : "Start Camera"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Scan Image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <Label htmlFor="manual-usn">Manual entry (USN)</Label>
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
          <Input
            id="manual-usn"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleManualSubmit();
            }}
            placeholder="e.g. 1BM22CS001"
            disabled={busy}
            className="w-full"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleManualSubmit()}
            disabled={busy || !manualValue.trim()}
            className="w-full"
          >
            Verify
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Tip: if camera scanning fails, take a photo of the QR and use
          &quot;Scan Image&quot; instead.
        </p>
      </div>
    </div>
  );
}
