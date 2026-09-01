import "dotenv/config";
import { db } from "@webcampus/db";

type CourseSeed = {
  code: string;
  name: string;
  program: "UG" | "PG";
  sem: number;
  mode: "INTEGRATED" | "NON_INTEGRATED";
  type: string;
  lecture: number;
  tutorial: number;
  practical: number;
  skill: number;
  lab?: boolean;
};

const COURSES: Record<string, CourseSeed[]> = {
  MA: [
    { code: "22MAT11", name: "Engineering Mathematics - I", program: "UG", sem: 1, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 1, practical: 0, skill: 0 },
    { code: "22MAT21", name: "Engineering Mathematics - II", program: "UG", sem: 3, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 1, practical: 0, skill: 0 },
    { code: "22MAT31", name: "Discrete Mathematical Structures", program: "UG", sem: 5, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22MAT41", name: "Applied Linear Algebra", program: "UG", sem: 7, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22MATM1", name: "Advanced Engineering Mathematics", program: "PG", sem: 1, mode: "INTEGRATED", type: "BS", lecture: 4, tutorial: 0, practical: 0, skill: 0 },
  ],
  PH: [
    { code: "22PHY12", name: "Engineering Physics", program: "UG", sem: 1, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 0, practical: 1, skill: 0, lab: true },
    { code: "22PHY22", name: "Applied Physics", program: "UG", sem: 3, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 0, practical: 1, skill: 0, lab: true },
  ],
  CY: [
    { code: "22CHE13", name: "Engineering Chemistry", program: "UG", sem: 1, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 0, practical: 1, skill: 0, lab: true },
    { code: "22CHE23", name: "Applied Chemistry", program: "UG", sem: 3, mode: "INTEGRATED", type: "BS", lecture: 3, tutorial: 0, practical: 1, skill: 0, lab: true },
  ],
  FY: [
    { code: "22ENG14", name: "Communicative English", program: "UG", sem: 1, mode: "NON_INTEGRATED", type: "HS", lecture: 2, tutorial: 0, practical: 0, skill: 0 },
    { code: "22CIE15", name: "Constitution of India and Human Rights", program: "UG", sem: 3, mode: "NON_INTEGRATED", type: "HS", lecture: 1, tutorial: 0, practical: 0, skill: 0 },
  ],
  CS: [
    { code: "22CS11", name: "Problem Solving using Python", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CS21", name: "Data Structures and Algorithms", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CS31", name: "Database Management Systems", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CS41", name: "Operating Systems", program: "UG", sem: 7, mode: "INTEGRATED", type: "PC", lecture: 4, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CSPG1", name: "Advanced Data Structures", program: "PG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CSPG2", name: "Machine Learning Techniques", program: "PG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  IS: [
    { code: "22IS11", name: "Web Technologies", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22IS21", name: "Object Oriented Programming with Java", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22IS31", name: "Computer Networks", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22IS41", name: "Software Engineering", program: "UG", sem: 7, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  EC: [
    { code: "22EC11", name: "Basic Electronics", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EC21", name: "Digital Electronics", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EC31", name: "Analog and Digital Communication", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EC41", name: "VLSI Design", program: "UG", sem: 7, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22ECPG1", name: "VLSI System Design", program: "PG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  EE: [
    { code: "22EE11", name: "Electrical Circuit Analysis", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22EE21", name: "Electrical Machines - I", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EE31", name: "Power Electronics", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EE41", name: "Electric Power Systems", program: "UG", sem: 7, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  ME: [
    { code: "22ME11", name: "Engineering Mechanics", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22ME21", name: "Thermodynamics", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22ME31", name: "Fluid Mechanics", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22ME41", name: "Machine Design", program: "UG", sem: 7, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  CE: [
    { code: "22CE11", name: "Building Materials and Construction", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22CE21", name: "Strength of Materials", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CE31", name: "Geotechnical Engineering", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CE41", name: "Structural Analysis", program: "UG", sem: 7, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  ET: [
    { code: "22ET11", name: "Electronic Circuits", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22ET21", name: "Signals and Systems", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22ET31", name: "Digital Communication", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  EI: [
    { code: "22EI11", name: "Instrumentation Fundamentals", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EI21", name: "Transducers and Measurement", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22EI31", name: "Process Control Instrumentation", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  MD: [
    { code: "22MD11", name: "Medical Electronics", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22MD21", name: "Biomedical Instrumentation", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  IM: [
    { code: "22IM11", name: "Industrial Engineering", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22IM21", name: "Production Planning and Control", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22IM31", name: "Supply Chain Management", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  MS: [
    { code: "22MS11", name: "Principles of Management", program: "UG", sem: 1, mode: "INTEGRATED", type: "MG", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22MSPG1", name: "Organizational Behaviour", program: "PG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22MSPG2", name: "Marketing Management", program: "PG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  CA: [
    { code: "22CAPG1", name: "Data Structures and C Programming", program: "PG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CAPG2", name: "Web Application Development", program: "PG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  AE: [
    { code: "22AE11", name: "Introduction to Aerospace Engineering", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22AE21", name: "Aerodynamics", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22AE31", name: "Aircraft Propulsion", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  ML: [
    { code: "22ML11", name: "Artificial Intelligence", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22ML21", name: "Machine Learning", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22ML31", name: "Deep Learning", program: "UG", sem: 5, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  CD: [
    { code: "22CD11", name: "Data Analytics Fundamentals", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CD21", name: "Big Data Analytics", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
  CI: [
    { code: "22CI11", name: "IoT Fundamentals", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CI21", name: "Cyber Security Essentials", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  AD: [
    { code: "22AD11", name: "Data Science Foundations", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22AD21", name: "Statistical Learning", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  CB: [
    { code: "22CB11", name: "Computer Concepts and C Programming", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22CB21", name: "Business Intelligence", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  CH: [
    { code: "22CH11", name: "Chemical Process Calculations", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
    { code: "22CH21", name: "Chemical Engineering Thermodynamics", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 0, skill: 0 },
  ],
  BT: [
    { code: "22BT11", name: "Biochemistry", program: "UG", sem: 1, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
    { code: "22BT21", name: "Microbiology", program: "UG", sem: 3, mode: "INTEGRATED", type: "PC", lecture: 3, tutorial: 0, practical: 2, skill: 0, lab: true },
  ],
};

async function main() {
  const semesters = await db.semester.findMany({ include: { academicTerm: true } });
  const depts = await db.department.findMany();
  const existing = await db.course.findMany({ select: { code: true } });
  const existingCodes = new Set(existing.map((c) => c.code));

  const semesterKey = (program: "UG" | "PG", num: number) => {
    const s = semesters.find((x) => x.programType === program && x.semesterNumber === num);
    return s;
  };

  let created = 0;
  let skipped = 0;

  for (const dept of depts) {
    const list = COURSES[dept.code];
    if (!list || list.length === 0) continue;
    for (const c of list) {
      if (existingCodes.has(c.code)) {
        skipped++;
        continue;
      }
      const sem = semesterKey(c.program, c.sem);
      if (!sem) {
        skipped++;
        continue;
      }
      const total =
        c.lecture + c.tutorial + c.practical + c.skill;
      await db.course.create({
        data: {
          code: c.code,
          name: c.name,
          departmentId: dept.id,
          departmentName: dept.name,
          semesterId: sem.id,
          semesterNumber: sem.semesterNumber,
          courseMode: c.mode,
          courseType: c.type as never,
          cycle: c.mode === "INTEGRATED" ? "NONE" : "NONE",
          lectureCredits: c.lecture,
          tutorialCredits: c.tutorial,
          practicalCredits: c.practical,
          skillCredits: c.skill,
          totalCredits: total,
          hasLaboratoryComponent: c.lab ?? false,
          seeMaxMarks: 100,
          seeEligibility: 40,
          cieMaxMarks: 50,
          cieEligibility: 40,
          theoryExamMaxMarks: 50,
          theoryMaxExams: 3,
          theoryMinExams: 1,
          theoryCieContribution: 50,
          theoryEligibility: 40,
          labMaxMarks: 50,
          labEligibility: 40,
          aatMaxMarks: 50,
          aatEligibility: 40,
          allowFeedback: true,
          attendanceRequired: true,
          approvalStatus: "APPROVED",
          version: 1,
        },
      });
      created++;
    }
  }

  console.log(`Created ${created} courses, skipped ${skipped} (already exist / no matching semester).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
