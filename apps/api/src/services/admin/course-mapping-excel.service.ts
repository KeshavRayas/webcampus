import { CourseAssignmentService } from "@webcampus/api/src/services/department/course-assignment.service";
import { db } from "@webcampus/db";
import ExcelJS from "exceljs";

export class AdminCourseMappingExcelService {
  static async generateTemplate(
    courseId: string,
    semesterId: string,
    departmentId: string
  ) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { department: true },
    });
    const semester = await db.semester.findUnique({
      where: { id: semesterId },
      include: { academicTerm: true },
    });

    if (!course || !semester) throw new Error("Course or semester not found");

    const sections = await db.section.findMany({
      where: { semesterId, departmentId },
      include: { batches: true },
      orderBy: { name: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Course Mapping");

    // Header Meta Data
    sheet.addRow([
      "Academic Term",
      `${semester.academicTerm.type} ${semester.academicTerm.year}`,
    ]);
    sheet.addRow(["Semester", semester.semesterNumber]);
    sheet.addRow(["Department/Cycle", course.department.name]);
    sheet.addRow(["Course Name", course.name]);
    sheet.addRow(["Course Code", course.code]);
    sheet.addRow([]); // added empty row for spacing

    // Table Headers
    sheet.addRow([
      "Section",
      "Batch (Leave Empty for Theory)",
      "Faculty ID",
      "Faculty Name (For your reference)",
    ]);

    // style the headers
    const headerRow = sheet.getRow(7);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // populate rows based on sections and batches
    sections.forEach((section) => {
      // theory row
      sheet.addRow([section.name, "", "", ""]);

      // lab batch rows (if it's an integrated/lab course, they can fill these in)
      if (course.practicalCredits && course.practicalCredits > 0) {
        section.batches.forEach((batch) => {
          sheet.addRow([section.name, batch.name, "", ""]);
        });
      }
    });

    // auto-fit columns
    sheet.columns.forEach((column) => {
      column.width = 30;
    });

    return await workbook.xlsx.writeBuffer();
  }

  static async parseAndUpsertUpload(
    fileBuffer: Buffer,
    courseId: string,
    semesterId: string,
    departmentId: string,
    academicYear: string,
    requestingUserId: string
  ): Promise<unknown> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet(1);

    if (!sheet) throw new Error("Invalid excel file format");

    const sectionMappingsMap = new Map<
      string,
      {
        sectionId: string;
        theoryFacultyId?: string;
        labFacultyByBatch: { batchName: string; facultyId: string }[];
      }
    >();

    // fetch section IDs to map names back to DB IDs
    const sections = await db.section.findMany({
      where: { semesterId, departmentId },
    });
    const sectionNameMap = new Map(sections.map((s) => [s.name, s.id]));

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < 0) return;

      const sectionName = row.getCell(1).text?.trim();
      const batchName = row.getCell(2).text?.trim();
      const facultyId = row.getCell(3).text?.trim();

      if (!sectionName || !facultyId) return; // skip empty rows

      const sectionId = sectionNameMap.get(sectionName);
      if (!sectionId) return;

      if (!sectionMappingsMap.has(sectionId)) {
        sectionMappingsMap.set(sectionId, {
          sectionId,
          theoryFacultyId: undefined,
          labFacultyByBatch: [],
        });
      }

      const mapping = sectionMappingsMap.get(sectionId)!;

      if (batchName) {
        // it is a lab assignment
        mapping.labFacultyByBatch.push({ batchName, facultyId });
      } else {
        mapping.theoryFacultyId = facultyId;
      }
    });

    const upsertData = {
      courseId,
      semesterId,
      academicYear,
      sectionMappings: Array.from(sectionMappingsMap.values()),
    };

    return await CourseAssignmentService.upsertMapping(
      upsertData,
      requestingUserId,
      {
        departmentId,
        requesterRole: "admin",
      }
    );
  }
}
