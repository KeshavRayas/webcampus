import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { TimetableEntry, TimetableSlot } from "./timetable-types";

const dayOrder: string[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const dayLabel = (day: string) => day.charAt(0) + day.slice(1).toLowerCase();

export const sortTimetableEntries = (entries: TimetableEntry[]) =>
  [...entries].sort(
    (a, b) =>
      dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek) ||
      a.startTime.localeCompare(b.startTime)
  );

const cellLabel = (entry: TimetableEntry) =>
  `${entry.course?.code ?? "-"}${entry.classType === "LAB" ? " Lab" : ""}`;

const deriveColumns = (entries: TimetableEntry[]): TimetableSlot[] => {
  const seen = new Set<string>();
  const columns: TimetableSlot[] = [];
  for (const entry of entries) {
    const key = `${entry.startTime}-${entry.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push({
      label: `${entry.startTime}-${entry.endTime}`,
      startTime: entry.startTime,
      endTime: entry.endTime,
    });
  }
  return columns.sort((a, b) => a.startTime.localeCompare(b.startTime));
};

export const downloadTimetablePdf = ({
  entries,
  slots,
  student,
}: {
  entries: TimetableEntry[];
  slots?: TimetableSlot[];
  student?: {
    user?: { name?: string | null } | null;
    usn?: string | null;
    departmentName?: string | null;
    semesterNumber?: number | null;
    currentSemester?: number;
    sectionName?: string | null;
  } | null;
}) => {
  const sorted = sortTimetableEntries(entries);
  if (!sorted.length) return;

  const columns = slots?.length ? slots : deriveColumns(sorted);

  const doc = new jsPDF({
    orientation: columns.length > 5 ? "landscape" : "portrait",
  });
  doc.setFontSize(16);
  doc.text("Weekly Timetable", 14, 16);
  doc.setFontSize(10);
  const lines = [
    `Name: ${student?.user?.name ?? "-"}`,
    `USN: ${student?.usn ?? "-"}`,
    `Department: ${student?.departmentName ?? "-"}`,
    `Semester: ${student?.semesterNumber ?? student?.currentSemester ?? "-"}`,
    `Section: ${student?.sectionName ?? "-"}`,
  ];
  lines.forEach((line, index) => doc.text(line, 14, 24 + index * 5));

  const head = ["Day", ...columns.map((column) => column.label)];
  const body = dayOrder
    .map((day) => {
      const dayEntries = sorted.filter((entry) => entry.dayOfWeek === day);
      if (!dayEntries.length) return null;
      const cells = columns.map((column) =>
        dayEntries
          .filter(
            (entry) =>
              entry.startTime === column.startTime &&
              entry.endTime === column.endTime
          )
          .map(cellLabel)
          .join("\n")
      );
      return [dayLabel(day), ...cells];
    })
    .filter((row): row is string[] => row !== null);

  autoTable(doc, {
    head: [head],
    body,
    startY: 52,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
  });

  const leftovers = sorted.filter(
    (entry) =>
      !columns.some(
        (column) =>
          column.startTime === entry.startTime &&
          column.endTime === entry.endTime
      )
  );
  if (leftovers.length) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY;
    let yPos = (finalY ?? 60) + 10;
    doc.setFontSize(12);
    doc.text("Other classes", 14, yPos);
    doc.setFontSize(9);
    for (const entry of leftovers) {
      yPos += 6;
      doc.text(
        `${dayLabel(entry.dayOfWeek)} · ${entry.startTime}-${entry.endTime} · ${cellLabel(entry)}`,
        14,
        yPos
      );
    }
  }

  doc.save(`timetable-${student?.usn ?? "student"}.pdf`);
};
