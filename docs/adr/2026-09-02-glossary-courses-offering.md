# Glossary — Courses / Offerings / Sections / Mapping

**Source:** Grill 2026-09-02

| Term | Meaning | Where |
|------|---------|-------|
| `Course` | Definition: `code, name, credits L-T-P-S, assessment (SEE/CIE/Theory/Lab/AAT), courseMode/courseType, departmentId, semesterId, cycle`. Created via `POST /admin/course` (`CourseService.createCourse`) and lives in `Semester → AcademicTerm`. `approvalStatus: DRAFT → PENDING → APPROVED`. | `apps/api/src/services/department/course.service.ts:104-305` |
| `AcademicTerm.type` | `odd`/`even`/`supplementary` + `parity` (`odd`/`even`) + `year`. Supplementary parity determines which `semesterNumber` are hosted (`supplementary.service.ts:218-228`, `semester.service.ts:285-297`). Label via `getTermLabel` (`packages/common/src/term-label.ts`). |  |
| `SupplementaryCourseOffering` | Link `academicTermId (supplementary) + courseId (existing APPROVED course)`. Does NOT copy semester. Parity/hostSemester resolved as `Semester(academicTermId=offering.term, programType, semesterNumber)` (`student/supplementary.service.ts:97-112`). | `supplementary.service.ts:183-275` |
| `ReRegistrationOffering` | Same pattern for `re-registration` type (RR) — separate surface, same lifecycle, kept standalone in this cut (`admin.router.ts:63-65`). |  |
| `Section` | Physical teaching section: `{ departmentId, semesterId, registrationType, supplementaryOfferingId?, cycle }` (`supplementary.service.ts:649-658`). Gate: `supplementaryWindowSettledMessage` blocks creation while window open (`:629,952`). Auto-inherits faculty from original term's `CourseAssignment` (`:660-746`). |  |
| `Course Mapping` | `CourseAssignment { courseId, sectionId/batchId, facultyId, assignmentType }`. Managed only in `Course Mapping` module, not in `Courses`. Shared grid, scope param `admin|department`. | `apps/web/modules/*course-mapping*` |
| `Offering vs Course` | Offering = *re-using* an approved course in another term (supplementary/RR). Course = definition. This ADR adds offering mode *inside* the Courses `Add Course` modal when `term.type==="supplementary"` (Dept+Course picker → `POST /admin/supplementary/offerings`). |  |
| `Host Semester` | The `Semester` row inside the supplementary/RR term that hosts the section, looked up by `(academicTermId, programType, semesterNumber)` — same resolution student registration uses. |  |
| `Window-settled gating` | `isRegistrationWindowOpen` → `evaluateRegistrationWindow` → `pickMostSpecific` (`registration-rules.ts:110-194`). `supplementaryWindowSettledMessage` is the invariant to keep (later `offeringWindowSettledMessage`). |  |

**Invariants preserved this cut:** `APPROVED`-only offering, parity match, window-closed before sections, faculty carry-over from original term's assignments.
