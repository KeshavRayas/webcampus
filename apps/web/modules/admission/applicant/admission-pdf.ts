"use client";

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function renderNodeToPdf(
  node: HTMLElement,
  filename: string
): Promise<string> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 150));

  const previousStyle = node.style.cssText;
  node.style.position = "fixed";
  node.style.top = "0";
  node.style.left = "0";
  node.style.zIndex = "-9999";
  node.style.width = "794px";
  node.style.maxHeight = "none";
  node.style.margin = "0";
  node.style.boxShadow = "none";

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: node.scrollWidth,
      height: node.scrollHeight,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    });
  } finally {
    node.style.cssText = previousStyle;
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = 210;
  const pageHeight = 297;
  const border = 4;
  const contentWidth = pageWidth - border * 2;
  const pxPerMm = canvas.width / contentWidth;
  const contentHeightPx = Math.floor((pageHeight - border * 2) * pxPerMm);
  let remaining = canvas.height;
  let offset = 0;
  let pageIndex = 0;
  while (remaining > 0) {
    const sliceH = Math.min(contentHeightPx, remaining);
    if (pageIndex > 0) pdf.addPage();
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceH;
    const ctx = pageCanvas.getContext("2d");
    ctx?.drawImage(
      canvas,
      0,
      offset,
      canvas.width,
      sliceH,
      0,
      0,
      canvas.width,
      sliceH
    );
    const pageData = pageCanvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(
      pageData,
      "JPEG",
      border,
      border,
      contentWidth,
      (sliceH / canvas.width) * contentWidth,
      undefined,
      "FAST"
    );
    remaining -= sliceH;
    offset += sliceH;
    pageIndex++;
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  return url;
}
