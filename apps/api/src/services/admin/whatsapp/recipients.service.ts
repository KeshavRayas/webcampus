import { db } from "@webcampus/db";
import type {
  MessageCategory,
  MessageFieldSource,
  MessageRecipientType,
  MessageScope,
  SendConfigType,
} from "@webcampus/schemas/admin";
import {
  formatNumber,
  renderMessageBody,
  resolveFieldSource,
  type ResolutionContext,
} from "./variable-resolver.service";

export type TemplateWithVars = {
  id: string;
  name: string;
  category: MessageCategory;
  recipientType: MessageRecipientType;
  externalTemplateId: string;
  smsTemplateId?: string;
  messageBody: string;
  variables: {
    position: number;
    label: string;
    fieldSource: MessageFieldSource;
  }[];
};

export type RecipientTarget = {
  studentId: string;
  usn: string;
  studentName: string;
  departmentName: string;
  sectionName: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  recipientType: MessageRecipientType;
  to: string | null;
  skipReason?: string;
  templateId: string;
  templateName: string;
  externalTemplateId: string;
  smsTemplateId?: string;
  templateMessageBody: string;
  bodyvar: string[];
  messageText: string;
};

export type ResolveResult = {
  category: MessageCategory;
  scope: MessageScope;
  studentTemplate?: TemplateWithVars;
  parentTemplate?: TemplateWithVars;
  targets: RecipientTarget[];
};

const CHUNK_SECTIONS_CAP = 500;

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

async function loadTemplate(
  id: string | undefined,
  label: string
): Promise<TemplateWithVars> {
  if (!id) throw new Error(`${label} template is required`);
  const template = await db.messageTemplate.findUnique({
    where: { id },
    include: { variables: { orderBy: { position: "asc" } } },
  });
  if (!template) throw new Error(`${label} template not found`);
  if (!template.isActive)
    throw new Error(`${label} template "${template.name}" is inactive`);
  return {
    id: template.id,
    name: template.name,
    category: template.category as MessageCategory,
    recipientType: template.recipientType as MessageRecipientType,
    externalTemplateId: template.externalTemplateId,
    smsTemplateId: template.smsTemplateId ?? undefined,
    messageBody: template.messageBody,
    variables: template.variables.map(
      (v: { position: number; label: string; fieldSource: string }) => ({
        position: v.position,
        label: v.label,
        fieldSource: v.fieldSource as MessageFieldSource,
      })
    ),
  };
}

type StudentWithContext = {
  studentId: string;
  usn: string;
  studentName: string;
  departmentName: string;
  sectionName: string;
  semester: number;
  academicYear: string;
  studentPhone: string | null;
  parentPhone: string | null;
};

function buildTarget(
  template: TemplateWithVars,
  ctx: ResolutionContext,
  student: StudentWithContext,
  opts: {
    recipientType: MessageRecipientType;
    to: string | null;
    skipReason?: string;
    course?: { id: string; code: string; name: string };
  }
): RecipientTarget {
  const values = new Map<MessageFieldSource, string>();
  for (const variable of template.variables) {
    values.set(
      variable.fieldSource,
      resolveFieldSource(variable.fieldSource, ctx)
    );
  }
  const bodyvar = template.variables.map(
    (variable) => values.get(variable.fieldSource) ?? ""
  );
  return {
    studentId: student.studentId,
    usn: student.usn,
    studentName: student.studentName,
    departmentName: student.departmentName,
    sectionName: student.sectionName,
    ...(opts.course
      ? {
          courseId: opts.course.id,
          courseCode: opts.course.code,
          courseName: opts.course.name,
        }
      : {}),
    recipientType: opts.recipientType,
    to: opts.to,
    ...(opts.skipReason ? { skipReason: opts.skipReason } : {}),
    templateId: template.id,
    templateName: template.name,
    externalTemplateId: template.externalTemplateId,
    smsTemplateId: template.smsTemplateId,
    templateMessageBody: template.messageBody,
    bodyvar,
    messageText: renderMessageBody(template.messageBody, values, bodyvar),
  };
}

export async function resolveTargets(
  config: SendConfigType
): Promise<ResolveResult> {
  const scope: MessageScope = config.scope;

  const studentTemplate =
    scope === "STUDENT" || scope === "BOTH"
      ? await loadTemplate(config.studentTemplateId, "Student")
      : undefined;
  const parentTemplate =
    scope === "PARENT" || scope === "BOTH"
      ? await loadTemplate(config.parentTemplateId, "Parent")
      : undefined;

  const templates: TemplateWithVars[] = [];
  if (studentTemplate) templates.push(studentTemplate);
  if (parentTemplate) templates.push(parentTemplate);
  if (templates.length === 0) {
    throw new Error("At least one template must be selected");
  }
  const firstTemplate = templates[0];
  if (!firstTemplate) {
    throw new Error("At least one template must be selected");
  }
  const category = firstTemplate.category;
  for (const t of templates) {
    if (t.category !== category) {
      throw new Error(
        "Student and parent templates must belong to the same category"
      );
    }
  }

  if (!config.sectionIds || config.sectionIds.length === 0) {
    return { category, scope, studentTemplate, parentTemplate, targets: [] };
  }

  const sectionRows = await db.section.findMany({
    where: { id: { in: config.sectionIds.slice(0, CHUNK_SECTIONS_CAP) } },
    select: { id: true, semesterId: true },
  });
  const semesterId =
    config.semesterId ??
    (sectionRows.length > 0 ? sectionRows[0]!.semesterId : undefined);

  const studentSections = await db.studentSection.findMany({
    where: { sectionId: { in: config.sectionIds } },
    include: {
      section: { include: { semester: true } },
      student: {
        include: {
          user: { select: { name: true } },
          admission: true,
          department: { select: { name: true, abbreviation: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const students: StudentWithContext[] = [];
  for (const row of studentSections) {
    if (seen.has(row.studentId)) continue;
    seen.add(row.studentId);
    const { student } = row;
    const admission = student.admission;
    students.push({
      studentId: student.id,
      usn: student.usn,
      studentName: student.user.name,
      departmentName: student.department.name ?? "",
      sectionName: row.section.name,
      semester: student.currentSemester,
      academicYear: student.academicYear,
      studentPhone: normalizePhone(
        admission?.primaryPhoneNumber ?? admission?.secondaryPhoneNumber
      ),
      parentPhone: normalizePhone(
        admission?.fatherNumber ??
          admission?.motherNumber ??
          admission?.guardianNumber
      ),
    });
  }

  const targets: RecipientTarget[] = [];

  let activeStudents = students;
  if (config.studentIds && config.studentIds.length > 0) {
    const allowed = new Set(config.studentIds);
    activeStudents = students.filter((s) => allowed.has(s.studentId));
  }
  const activeStudentIds = activeStudents.map((s) => s.studentId);

  if (category === "CIE") {
    const registrations = await db.courseRegistration.findMany({
      where: {
        studentId: { in: activeStudentIds },
        ...(semesterId ? { semesterId } : {}),
        ...(config.subjectIds && config.subjectIds.length > 0
          ? { courseId: { in: config.subjectIds } }
          : {}),
      },
      include: { course: true },
    });

    const courseIds = Array.from(new Set(registrations.map((r) => r.courseId)));
    const cieNumber = config.cieNumber ?? 1;

    const marks = await db.mark.findMany({
      where: {
        studentId: { in: activeStudentIds },
        ...(courseIds.length > 0 ? { courseId: { in: courseIds } } : {}),
      },
    });
    const markKey = `cie${cieNumber}` as "cie1" | "cie2" | "cie3";
    const marksMap = new Map<string, number | null>();
    for (const mark of marks) {
      marksMap.set(`${mark.studentId}:${mark.courseId}`, mark[markKey] ?? null);
    }

    const assessments = await db.assessmentTemplate.findMany({
      where: {
        courseId: { in: courseIds },
        ...(semesterId ? { semesterId } : {}),
        componentType: "THEORY",
        sequence: cieNumber,
      },
      select: { courseId: true, totalMarks: true },
    });
    const cieMaxMap = new Map<string, number>();
    for (const a of assessments) {
      cieMaxMap.set(a.courseId, a.totalMarks);
    }

    const maxMarksSource = config.maxMarksSource ?? "ASSESSMENT";

    const resolveMax = (
      course: {
        cieMaxMarks: number;
        theoryExamMaxMarks: number;
        labMaxMarks: number;
        aatMaxMarks: number;
      },
      assessmentMax: number | null
    ): number | null => {
      switch (maxMarksSource) {
        case "THEORY":
          return course.theoryExamMaxMarks > 0
            ? course.theoryExamMaxMarks
            : assessmentMax;
        case "LAB":
          return course.labMaxMarks > 0 ? course.labMaxMarks : assessmentMax;
        case "AAT":
          return course.aatMaxMarks > 0 ? course.aatMaxMarks : assessmentMax;
        case "CIE":
          return course.cieMaxMarks > 0 ? course.cieMaxMarks : assessmentMax;
        case "ASSESSMENT":
        default:
          return (
            assessmentMax ??
            (course.cieMaxMarks > 0 ? course.cieMaxMarks : null)
          );
      }
    };

    for (const student of activeStudents) {
      const studentRegs = registrations.filter(
        (r) => r.studentId === student.studentId
      );
      if (studentRegs.length === 0) {
        addScopeTargets(
          targets,
          student,
          studentTemplate,
          parentTemplate,
          scope,
          (template, recipientType) =>
            buildTarget(template, baseCtx(student), student, {
              recipientType,
              to: null,
              skipReason: "No registered subjects",
            }),
          null
        );
        continue;
      }

      const detailsParts: string[] = [];
      for (const reg of studentRegs) {
        const course = reg.course;
        const obtained =
          marksMap.get(`${student.studentId}:${course.id}`) ?? null;
        const max = resolveMax(course, cieMaxMap.get(course.id) ?? null);
        const last3 = course.code.slice(-3);
        detailsParts.push(
          `${last3}:(${formatNumber(obtained)}/${formatNumber(max)})`
        );
      }

      const ctx: ResolutionContext = {
        ...baseCtx(student),
        cieNumber,
        cieMarksDetails: detailsParts.join(", "),
      };
      addScopeTargets(
        targets,
        student,
        studentTemplate,
        parentTemplate,
        scope,
        (template, recipientType) =>
          buildTarget(template, ctx, student, {
            recipientType,
            to: null,
            skipReason: "No phone number",
          }),
        ctx
      );
    }
  } else {
    const finance = await loadFinanceData(activeStudentIds);
    const financeByStudent = new Map(finance.map((f) => [f.studentId, f]));

    for (const student of activeStudents) {
      const financeRecord = financeByStudent.get(student.studentId);
      const ctx: ResolutionContext = {
        ...baseCtx(student),
        ...(financeRecord ? { finance: financeRecord } : {}),
        adHoc: config.adHocData,
      };
      addScopeTargets(
        targets,
        student,
        studentTemplate,
        parentTemplate,
        scope,
        (template, recipientType) =>
          buildTarget(template, ctx, student, {
            recipientType,
            to: null,
            skipReason: "No phone number",
          }),
        ctx
      );
    }
  }

  return { category, scope, studentTemplate, parentTemplate, targets };
}

function baseCtx(student: StudentWithContext): ResolutionContext {
  return {
    studentName: student.studentName,
    usn: student.usn,
    departmentName: student.departmentName,
    sectionName: student.sectionName,
    semester: student.semester,
    academicYear: student.academicYear,
  };
}

function addScopeTargets(
  targets: RecipientTarget[],
  student: StudentWithContext,
  studentTemplate: TemplateWithVars | undefined,
  parentTemplate: TemplateWithVars | undefined,
  scope: MessageScope,
  buildSkipped: (
    template: TemplateWithVars,
    recipientType: MessageRecipientType
  ) => RecipientTarget,
  ctx: ResolutionContext | null
): void {
  if (scope === "STUDENT" || scope === "BOTH") {
    if (studentTemplate) {
      if (student.studentPhone) {
        targets.push(
          buildTarget(studentTemplate, ctx!, student, {
            recipientType: "STUDENT",
            to: student.studentPhone,
          })
        );
      } else {
        targets.push(buildSkipped(studentTemplate, "STUDENT"));
      }
    }
  }
  if (scope === "PARENT" || scope === "BOTH") {
    if (parentTemplate) {
      if (student.parentPhone) {
        targets.push(
          buildTarget(parentTemplate, ctx!, student, {
            recipientType: "PARENT",
            to: student.parentPhone,
          })
        );
      } else {
        targets.push(buildSkipped(parentTemplate, "PARENT"));
      }
    }
  }
}

type FinanceSummary = {
  studentId: string;
  demand: number;
  paid: number;
  balance: number;
};

async function loadFinanceData(
  studentIds: string[]
): Promise<FinanceSummary[]> {
  const records = await db.finance.findMany({
    where: { studentId: { in: studentIds } },
    include: { payments: true },
    orderBy: { updatedAt: "desc" },
  });
  const summaries = new Map<string, FinanceSummary>();
  for (const record of records) {
    if (summaries.has(record.studentId)) continue;
    const paid = record.payments.reduce((sum, p) => sum + p.amount, 0);
    const demand = record.finalFee;
    summaries.set(record.studentId, {
      studentId: record.studentId,
      demand,
      paid,
      balance: Math.max(demand - paid, 0),
    });
  }
  return Array.from(summaries.values());
}
