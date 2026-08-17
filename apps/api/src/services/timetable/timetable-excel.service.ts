import ExcelJS from "exceljs";
import { TimetableService } from "./timetable.service";

type Slot = { label: string; startTime: string; endTime: string };
type CourseReference = {
  id: string;
  code: string;
  name: string;
  handlingFaculty?: Array<{ name: string; sectionId: string }>;
};
const days = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export class TimetableExcelService {
  static async template(semesterId: string, slots: Slot[]) {
    const reference = await TimetableService.getTemplateData(semesterId);
    const workbook = new ExcelJS.Workbook();
    const instructions = workbook.addWorksheet("Instructions");
    instructions.addRow(["TIMETABLE IMPORT INSTRUCTIONS"]);
    instructions.addRow([
      "Select a course code in each timetable cell. Leave cells blank where there is no class.",
    ]);
    instructions.addRow([
      "Do not rename section sheets or change the day/time headers.",
    ]);
    instructions.addRow([
      "Complete all required section sheets before uploading the workbook.",
    ]);
    instructions.addRow([]);
    instructions.addRow(["Course Code", "Course Name", "Handling Faculty"]);
    (reference.courses as unknown as CourseReference[]).forEach((course) => {
      const facultyNames =
        course.handlingFaculty?.map((faculty) => faculty.name).join(", ") ||
        "Not assigned";
      instructions.addRow([course.code, course.name, facultyNames]);
    });

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
      (reference.courses as unknown as CourseReference[]).forEach((course) => {
        const facultyNames =
          course.handlingFaculty
            ?.filter((faculty) => faculty.sectionId === section.id)
            .map((faculty) => faculty.name)
            .join(", ") || "Not assigned";
        sheet.addRow([course.code, course.name, facultyNames]);
      });
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
            const value = String(row.getCell(index + 2).value ?? "")
              .trim()
              .toUpperCase();
            if (!value) return;
            const course = codeMap.get(value) as
              | { id: string; code: string }
              | undefined;
            if (!course) {
              errors.push({
                sheet: sheet.name,
                cell: row.getCell(index + 2).address,
                message: `Unknown course code ${value}`,
              });
              return;
            }
            entries.push({
              courseId: course.id,
              courseCode: course.code,
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
