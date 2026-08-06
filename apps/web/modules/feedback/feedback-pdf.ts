"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadFeedbackPdf({
  title,
  metadata,
  headers,
  rows,
  filename,
}: {
  title: string;
  metadata: string[];
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

  let yPos = 28;
  metadata.forEach((text) => {
    doc.text(text, 14, yPos);
    yPos += 5;
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: yPos + 3,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
  });

  doc.save(filename);
}
