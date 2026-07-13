import { hallTicketHtml } from "../packages/ui/src/lib/hall-ticket/html";
import type { HallTicketTemplateData } from "../packages/ui/src/lib/hall-ticket/template";
import { readFileSync, writeFileSync } from "fs";

async function main() {
  const sampleData: HallTicketTemplateData = {
    id: "debug-sample",
    isSent: true,
    sentAt: new Date().toISOString(),
    sentBy: "admin",
    generatedAt: new Date().toISOString(),
    student: {
      usn: "1BM22CS001",
      name: "Sample Student Name",
      photo: null,
      departmentName: "Computer Science & Engineering",
      currentSemester: 6,
      programType: "B.E.",
      academicTermLabel: "ODD 2025-26",
      sectionName: "A",
    },
    courses: [
      {
        courseAssignmentId: "ca1",
        courseCode: "18CS61",
        courseName: "Software Engineering & Project Management",
        courseType: "THEORY",
        credits: 3,
        cieTotal: 42,
        attendancePercentage: 85,
        isFrozen: true,
        markEligible: true,
        attendanceEligible: true,
        eligible: true,
        status: "ELIGIBLE",
      },
      {
        courseAssignmentId: "ca2",
        courseCode: "18CS62",
        courseName: "Computer Networks",
        courseType: "THEORY",
        credits: 3,
        cieTotal: 22,
        attendancePercentage: 65,
        isFrozen: true,
        markEligible: false,
        attendanceEligible: false,
        eligible: false,
        status: "NOT_ELIGIBLE",
      },
      {
        courseAssignmentId: "ca3",
        courseCode: "18CS63",
        courseName: "Database Management Systems",
        courseType: "THEORY",
        credits: 3,
        cieTotal: 38,
        attendancePercentage: 90,
        isFrozen: true,
        markEligible: true,
        attendanceEligible: true,
        eligible: true,
        status: "ELIGIBLE",
      },
      {
        courseAssignmentId: "ca4",
        courseCode: "18CSL64",
        courseName: "Computer Networks Laboratory",
        courseType: "LAB",
        credits: 1.5,
        cieTotal: 45,
        attendancePercentage: 88,
        isFrozen: true,
        markEligible: true,
        attendanceEligible: true,
        eligible: true,
        status: "ELIGIBLE",
      },
      {
        courseAssignmentId: "ca5",
        courseCode: "18CS65",
        courseName: "Artificial Intelligence",
        courseType: "THEORY",
        credits: 3,
        cieTotal: 35,
        attendancePercentage: 78,
        isFrozen: true,
        markEligible: true,
        attendanceEligible: true,
        eligible: true,
        status: "ELIGIBLE",
      },
    ],
  };

  const logoBase64 = (() => {
    try {
      const svg = readFileSync("apps/web/public/bmsce.svg", "utf-8");
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    } catch {
      return "/bmsce.svg";
    }
  })();

  const html = await hallTicketHtml(sampleData, logoBase64);
  writeFileSync("debug-ssr.html", html, "utf-8");
  console.log("SSR HTML saved to debug-ssr.html");
}

main().catch(console.error);
