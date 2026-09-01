import "dotenv/config";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { db } from "@webcampus/db";

const DEFAULT_PASSWORD = "password";

const DEPT_CODES = ["CS", "IS", "EC", "EE", "ME", "CE"];
const UG_SEM = 3;
const STUDENTS_PER_DEPT = 8;

const FIRST = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Vihaan",
  "Arjun",
  "Sai",
  "Rohan",
  "Dev",
  "Karthik",
  "Rahul",
  "Nikhil",
  "Siddharth",
  "Ananya",
  "Diya",
  "Isha",
  "Meghana",
  "Navya",
  "Pooja",
  "Shreya",
  "Tanvi",
  "Sneha",
  "Kavya",
  "Ritika",
  "Priya",
];
const LAST = [
  "Sharma",
  "Verma",
  "Patel",
  "Reddy",
  "Kumar",
  "Nair",
  "Iyer",
  "Rao",
  "Gupta",
  "Singh",
  "Das",
  "Menon",
  "Pillai",
  "Bhat",
  "Hegde",
  "Kulkarni",
  "Joshi",
  "Deshmukh",
];

type DeptInfo = { id: string; name: string };

async function main() {
  const { ADMIN_USER_EMAIL, ADMIN_USER_PASSWORD } = backendEnv();
  const signIn = await auth.api.signInEmail({
    body: { email: ADMIN_USER_EMAIL, password: ADMIN_USER_PASSWORD },
  });
  if (!signIn.token) throw new Error("Admin sign-in failed");
  const headers = { Authorization: `Bearer ${signIn.token}` };

  const semesters = await db.semester.findMany({
    include: { academicTerm: true },
  });
  const ugSem = semesters.find(
    (s) => s.programType === "UG" && s.semesterNumber === UG_SEM
  );
  if (!ugSem) throw new Error("UG semester not found");
  const term = ugSem.academicTerm;

  const depts = await db.department.findMany();
  const deptByCode = new Map<string, DeptInfo>(
    depts.filter((d) => DEPT_CODES.includes(d.code)).map((d) => [d.code, { id: d.id, name: d.name }])
  );

  const courses = await db.course.findMany({
    where: { semesterId: ugSem.id },
    select: { id: true, code: true, departmentId: true },
  });
  const coursesByDept = new Map<string, string[]>();
  for (const c of courses) {
    const arr = coursesByDept.get(c.departmentId) ?? [];
    arr.push(c.id);
    coursesByDept.set(c.departmentId, arr);
  }

  let usersCreated = 0;
  let studentsCreated = 0;
  let regsCreated = 0;

  for (const code of DEPT_CODES) {
    const dept = deptByCode.get(code);
    if (!dept) {
      console.log(`Skipping ${code}: dept not found`);
      continue;
    }

    // Ensure a Section exists for this dept in this semester.
    let section = await db.section.findUnique({
      where: { name_departmentId_semesterId: { name: "A", departmentId: dept.id, semesterId: ugSem.id } },
    });
    if (!section) {
      section = await db.section.create({
        data: {
          name: "A",
          departmentId: dept.id,
          departmentName: dept.name,
          semesterId: ugSem.id,
          cycle: "NONE",
        },
      });
    }

    for (let i = 0; i < STUDENTS_PER_DEPT; i++) {
      const name = `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${
        LAST[Math.floor(Math.random() * LAST.length)]
      }`;
      const username = `${code.toLowerCase()}${2024 + (i % 2)}${String(UG_SEM * 10 + (i % 8)).padStart(2, "0")}`;
      const email = `${username}@webcampus.com`;
      const year = term.year; // e.g. "2026"

      // USN prefix derived from department code + academic year batch.
      const usn = `4X${year.slice(2)}${code}${String(i + 1).padStart(3, "0")}`;

      // Create student-role user (reuses admin flow).
      let user = await db.user.findUnique({ where: { email } });
      if (!user) {
        const service = new UserService({
          request: {
            name,
            email,
            username,
            password: DEFAULT_PASSWORD,
            role: "student",
          },
          headers,
        });
        const result = await service.create();
        if (result.status === "error" || !result.data?.id) {
          console.log(`  create user failed for ${email}: ${result.message}`);
          continue;
        }
        user = result.data as { id: string };
        usersCreated++;
      }

      // Create or update Student record.
      let student = await db.student.findUnique({ where: { userId: user.id } });
      if (!student) {
        student = await db.student.create({
          data: {
            userId: user.id,
            usn,
            departmentName: dept.name,
            currentSemester: UG_SEM,
            academicYear: year,
            semesterId: ugSem.id,
            semesterNumber: UG_SEM,
            programType: "UG",
            academicTermId: term.id,
            academicTermType: term.type,
            academicTermYear: term.year,
            academicTermLabel: `${term.type.toUpperCase()} ${term.year}`,
          },
        });
        studentsCreated++;
      }

      // Link to section.
      const existingSs = await db.studentSection.findFirst({
        where: { studentId: student.id, sectionId: section.id, semester: UG_SEM, academicYear: year },
      });
      if (!existingSs) {
        await db.studentSection.create({
          data: {
            studentId: student.id,
            sectionId: section.id,
            semester: UG_SEM,
            academicYear: year,
          },
        });
      }

      // Register the student for the dept's courses this semester.
      const deptCourses = coursesByDept.get(dept.id) ?? [];
      for (const courseId of deptCourses) {
        const exists = await db.courseRegistration.findUnique({
          where: { studentId_courseId: { studentId: student.id, courseId } },
        });
        if (!exists) {
          await db.courseRegistration.create({
            data: {
              studentId: student.id,
              courseId,
              semesterId: ugSem.id,
              academicTermId: term.id,
            },
          });
          regsCreated++;
        }
      }

      // Update the user to carry the USN as display.
      if (user.id) {
        try {
          await db.user.update({
            where: { id: user.id },
            data: { username: usn, displayUsername: name },
          });
        } catch {
          /* usn may collide with existing username; ignore */
        }
      }
    }

    console.log(`Seeded ${code}: section ${section.name}, ${STUDENTS_PER_DEPT} students`);
  }

  console.log(`DONE: ${usersCreated} users created, ${studentsCreated} students, ${regsCreated} registrations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
