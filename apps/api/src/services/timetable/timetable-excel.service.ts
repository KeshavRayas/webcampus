import ExcelJS from "exceljs";
import { TimetableService } from "./timetable.service";

type Slot = { label: string; startTime: string; endTime: string };
type FacultyReference = {
  id: string;
  name: string;
  sectionId: string;
  assignmentType: "THEORY" | "LAB";
};
type CourseReference = {
  id: string;
  code: string;
  name: string;
  hasLaboratoryComponent?: boolean;
  handlingFaculty?: FacultyReference[];
  handlingFacultyElective?: FacultyReference[];
};
type ReferenceRow = { code: string; name: string; faculty: string };
const days = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const buildReferenceRows = (
  courses: CourseReference[],
  sectionId?: string
): ReferenceRow[] => {
  const rows: ReferenceRow[] = [];
  for (const course of courses) {
    const handling =
      course.handlingFaculty?.filter(
        (faculty) => !sectionId || faculty.sectionId === sectionId
      ) ?? [];
    const handlingElective =
      course.handlingFacultyElective?.filter(
        (faculty) =>
          !sectionId || !faculty.sectionId || faculty.sectionId === sectionId
      ) ?? [];
    // Aggregate PE/OE across all batches per course-section, deduped by faculty id
    const combined = [...handling, ...handlingElective];
    const dedupedMap = new Map<string, FacultyReference>();
    for (const f of combined) {
      if (!dedupedMap.has(f.id)) dedupedMap.set(f.id, f);
    }
    const deduped = [...dedupedMap.values()];
    const theoryFaculty = deduped.filter(
      (faculty) => faculty.assignmentType === "THEORY"
    );
    const labFaculty = deduped.filter(
      (faculty) => faculty.assignmentType === "LAB"
    );

    if (course.hasLaboratoryComponent) {
      if (theoryFaculty.length) {
        rows.push({
          code: course.code,
          name: course.name,
          faculty: theoryFaculty.map((faculty) => faculty.name).join(", "),
        });
      }
      rows.push({
        code: `${course.code} Lab`,
        name: course.name,
        faculty:
          labFaculty.map((faculty) => faculty.name).join(", ") ||
          "Not assigned",
      });
    } else {
      rows.push({
        code: course.code,
        name: course.name,
        faculty:
          theoryFaculty.map((faculty) => faculty.name).join(", ") ||
          "Not assigned",
      });
    }
  }
  return rows;
};

export class TimetableExcelService {
  static async template(semesterId: string, slots: Slot[]) {
    const reference = await TimetableService.getTemplateData(semesterId);
    const courses = reference.courses as unknown as CourseReference[];
    const workbook = new ExcelJS.Workbook();
    const instructions = workbook.addWorksheet("Instructions");
    instructions.addRow(["TIMETABLE IMPORT INSTRUCTIONS"]);
    instructions.addRow([
      "Select a course code in each timetable cell. Leave cells blank where there is no class.",
    ]);
    instructions.addRow([
      "Courses with a laboratory component appear as '<CODE> Lab'. Enter '<CODE> Lab' for lab sessions and the plain code for theory sessions.",
    ]);
    instructions.addRow([
      "Do not rename section sheets or change the day/time headers.",
    ]);
    instructions.addRow([
      "Complete all required section sheets before uploading the workbook.",
    ]);
    instructions.addRow([]);
    instructions.addRow(["Course Code", "Course Name", "Handling Faculty"]);
    buildReferenceRows(courses).forEach((row) =>
      instructions.addRow([row.code, row.name, row.faculty])
    );

    for (const section of reference.sections as Array<{
      id: string;
      name: string;
    }>) {
      const sheet = workbook.addWorksheet(section.name.slice(0, 31));
      sheet.addRow([`SECTION: ${section.name}`]);
      sheet.addRow(["Day", ...slots.map((slot) => slot.label)]);
      days.forEach((day) => sheet.addRow([day, ...slots.map(() => "")]));
      sheet.addRow([]);
      sheet.addRow(["Course Code", "Course Name", "Handling Faculty"]);
      buildReferenceRows(courses, section.id).forEach((row) =>
        sheet.addRow([row.code, row.name, row.faculty])
      );
    }
    return workbook.xlsx.writeBuffer();
  }

  static async parse(buffer: Buffer, semesterId: string, slots: Slot[]) {
    const reference = await TimetableService.getTemplateData(semesterId);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sectionByName = new Map(
      (reference.sections as Array<{ id: string; name: string }>).map(
        (section) => [section.name.slice(0, 31), section]
      )
    );
    const errors: Array<{ sheet: string; cell: string; message: string }> = [];
    const entries: Array<Record<string, string>> = [];
    workbook.worksheets
      .filter((sheet) => sheet.name !== "Instructions")
      .forEach((sheet) => {
        const section = sectionByName.get(sheet.name);
        if (!section) {
          errors.push({
            sheet: sheet.name,
            cell: "A1",
            message: "Sheet does not match a section in this semester",
          });
          return;
        }
        const codeMap = new Map(
          (reference.courses as unknown as CourseReference[]).map((course) => [
            course.code.toUpperCase(),
            course,
          ])
        );
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber < 3 || rowNumber > days.length + 2) return;
          const day = String(row.getCell(1).value ?? "").toUpperCase();
          if (!days.includes(day)) return;
          slots.forEach((slot, index) => {
            const raw = String(row.getCell(index + 2).value ?? "").trim();
            const isLab = /\s+lab$/i.test(raw);
            const code = raw.replace(/\s+lab$/i, "").toUpperCase();
            if (!code) return;
            const course = codeMap.get(code) as
              | { id: string; code: string }
              | undefined;
            if (!course) {
              errors.push({
                sheet: sheet.name,
                cell: row.getCell(index + 2).address,
                message: `Unknown course code ${raw}`,
              });
              return;
            }
            entries.push({
              courseId: course.id,
              courseCode: course.code,
              classType: isLab ? "LAB" : "LECTURE",
              dayOfWeek: day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              sectionId: section.id,
            });
          });
        });
      });
    return { valid: errors.length === 0, errors, entries };
  }
}
