"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- REQUIRED DATA STRUCTURES ---
export interface FeedbackReportMetadata {
  academicYear: string;
  semester: string;
  program: string;
  branch: string;
  courseCode: string;
  courseName: string;
  section: string;
  facultyName: string;
  totalStudents: number | string;
}

export interface QuestionData {
  qNo: number | string;
  question: string;
  excellent: number;
  veryGood: number;
  good: number;
  fair: number;
  poor: number;
  rowTotal: number; // Sum of responses for this question
  rowAverage: string | number; // Average score for this question
}

export interface ColumnTotals {
  excellent: number; // Total 'Excellent' across all questions
  veryGood: number;
  good: number;
  fair: number;
  poor: number;
  overallAverage: string | number; // Final overall average for the faculty
}

export function downloadFeedbackPdf({
  metadata,
  questions,
  totals,
  filename,
  leftLogoBase64,
  rightLogoBase64,
}: {
  metadata: FeedbackReportMetadata;
  questions: QuestionData[];
  totals: ColumnTotals;
  filename: string;
  leftLogoBase64?: string;
  rightLogoBase64?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- HEADER SECTION (Logos & Titles) ---
  if (leftLogoBase64) doc.addImage(leftLogoBase64, "PNG", 14, 10, 25, 25);
  if (rightLogoBase64)
    doc.addImage(rightLogoBase64, "PNG", pageWidth - 39, 10, 25, 25);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BMS University", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "(An Autonomous Institution affiliated to VTU, Belagavi)",
    pageWidth / 2,
    24,
    { align: "center" }
  );
  doc.text(
    "Bull Temple Road,Basavangudi,Banglore, Karnataka, India",
    pageWidth / 2,
    29,
    { align: "center" }
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TEACHERS EVALUATION REPORT", pageWidth / 2, 38, {
    align: "center",
  });

  const titleWidth = doc.getTextWidth("TEACHERS EVALUATION REPORT");
  doc.setLineWidth(0.5);
  doc.line((pageWidth - titleWidth) / 2, 39, (pageWidth + titleWidth) / 2, 39);

  // --- METADATA SECTION ---
  doc.setFontSize(10);
  const leftColX = 14;
  const rightColX = pageWidth / 2 + 10;
  let currentY = 50;
  const lineSpacing = 7;

  const renderMetaRow = (
    label1: string,
    val1: string,
    label2: string,
    val2: string
  ) => {
    doc.setFont("helvetica", "bold");
    doc.text(label1, leftColX, currentY);
    doc.text(label2, rightColX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(val1, leftColX + doc.getTextWidth(label1), currentY);
    doc.text(val2, rightColX + doc.getTextWidth(label2), currentY);
    currentY += lineSpacing;
  };

  renderMetaRow(
    "Academic Year : ",
    metadata.academicYear,
    "Semester : ",
    metadata.semester
  );
  renderMetaRow("Program : ", metadata.program, "Branch : ", metadata.branch);
  renderMetaRow(
    "Course Code : ",
    metadata.courseCode,
    "Course Name : ",
    metadata.courseName
  );
  renderMetaRow(
    "Section : ",
    metadata.section,
    "Faculty Name : ",
    metadata.facultyName
  );

  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total Number of Students Responded : ${metadata.totalStudents}`,
    pageWidth - 14,
    currentY,
    { align: "right" }
  );

  // --- TABLE DATA PREPARATION ---
  const tableHeaders = [
    [
      "Q.No",
      "Question",
      "Excellent",
      "Very Good",
      "Good",
      "Fair",
      "Poor",
      "Total",
      "Average",
    ],
  ];

  // Map the strict objects into arrays for jsPDF
  const tableBody = questions.map((q) => [
    q.qNo,
    q.question,
    q.excellent,
    q.veryGood,
    q.good,
    q.fair,
    q.poor,
    q.rowTotal,
    q.rowAverage,
  ]);

  // The 'foot' will automatically render at the bottom of the table with distinct styling
  const tableFoot = [
    [
      {
        content: "Total",
        colSpan: 2,
        styles: { halign: "center", fontStyle: "bold" } as const,
      },
      totals.excellent,
      totals.veryGood,
      totals.good,
      totals.fair,
      totals.poor,
      "-", // Total of totals (usually redundant, so left blank)
      "-",
    ],
    [
      {
        content: "Overall Average",
        colSpan: 8,
        styles: { halign: "right", fontStyle: "bold" } as const,
      },
      totals.overallAverage,
    ],
  ];

  // --- RENDER TABLE ---
  autoTable(doc, {
    head: tableHeaders,
    body: tableBody,
    foot: tableFoot,
    startY: currentY + 4,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 15 }, // Q.no
      1: { halign: "left", cellWidth: 80 }, // Question (wider, left-aligned)
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
  });

  doc.save(filename);
}
