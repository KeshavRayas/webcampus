# ADR: Remove Supplementary & Exam Registrations surfaces, manual faculty for supplementary sections

**Date:** 2026-09-03
**Status:** Accepted (from grill 2026-09-02 → 2026-09-03)
**Supersedes:** `2026-09-02-adr-unified-courses-offering.md` §3/§6 keeping `/admin/supplementary` intact; supplements `2026-09-02-glossary-courses-offering.md`.

**Context:** `403 Cannot modify faculty assignments for a locked course` was triggered by mapping supplementary courses through `POST /course-assignment/upsert` (`apps/api/src/services/department/course-assignment.service.ts:650-658`, locked = `approvalStatus ∈ {PENDING,APPROVED}`). Supplementary tab was still mounted in Academics (`sidebar-config.ts:167-169`) while Courses already had an Add Offering branch for `term.type==="supplementary"` (`admin-semester-course-block.tsx:33-45`). Exam Registrations admin listing (`/admin/exam-registrations`) duplicated data already visible via Registration Tracking + promotion/hall-ticket backends. Auto-inherited faculty in `createSupplementarySection:663-749` copied original-term assignments, but operations require per-supplementary faculty choice.

## Decision

### 1. Locked stays; supplementary never uses Course Mapping

`locked = PENDING|APPROVED` unchanged. `POST /course-assignment/upsert` and `PUT /course/:id/coordinators` (`course.service.ts:824-836`) remain blocked for non-admin without `isSuperEdit`. Supplementary faculty is **not** a Course Mapping concern — no `isSuperEdit` bypass for supplementary. `course-mapping-view.tsx:97-104` (admin + dept) becomes read-only for `term.type==="supplementary"` with banner:

> "This is a supplementary term — faculty assignments are managed in Courses → Supplementary Sections, not here. This mapping is read-only." CTA `Go to Courses → /admin/courses?academicTermId={termId}&semesterId={semesterId}`. Grid force-disabled (`isLocked || isSupplementaryTerm`), no Super Edit.

### 2. Courses is the sole Add Offering entry; Supplementary page deleted

*Keep backend, delete frontend.* `apps/api/src/routers/admin/supplementary.router.ts`, `controllers/admin/supplementary.controller.ts`, `services/admin/supplementary.service.ts`, `schemas/admin/supplementary.schema.ts`, `permissions.ts:24` `supplementary:*`, and mount `admin.router.ts:65` **stay**. Endpoints `GET /terms/:id/offerings`, `POST /offerings`, `DELETE /offerings/:id`, `POST /offerings/:id/sections`, `GET /offerings/:id/sections`, `POST /sections/:id/students`, `GET /registrations`, `GET /terms/:id/demand` remain for the Courses block and for `student/supplementary.service.ts:291,393` + `hall-ticket.service.ts:242` which read `SupplementaryCourseOffering` directly.

*Delete:* `apps/web/app/(protected)/admin/supplementary/page.tsx` (dir), `apps/web/modules/admin/supplementary/supplementary-view.tsx`, sidebar entry `Supplementary → /admin/supplementary` (`sidebar-config.ts:166-169`). *Move:* `modules/admin/supplementary/use-supplementary-admin.ts` → `modules/admin/courses/use-supplementary-admin.ts` (kept hooks: `useSupplementaryOfferings`, `useSupplementaryRegistrations`, `useSupplementaryDemand`, `useSupplementarySections`, `useCreateSupplementarySection`, `useAssignSupplementaryStudents`, `useSupplementaryCandidateCourses`, `useAdd/DeleteOffering`). Update import in `admin-supplementary-offering-block.tsx:24-29`.

Dual modal in Courses remains canonical: `term.type !== supplementary` → `CourseFormFields` → `POST /admin/course`; `term.type === supplementary` → Dept picker + `GET /admin/course/supplementary-candidates?departmentId&parity` (parity-matched `APPROVED` only) → `POST /admin/supplementary/offerings {academicTermId,courseId}`. Parity guard `supplementary.service.ts:218-232` unchanged.

### 3. Two lifecycles, one Course definition

*Regular:* `Semester → Sections → Course(DRAFT) → Coordinators (before submit) → Mapping → bulkSubmit→PENDING→approve→APPROVED → RegistrationWindow open → CourseRegistration → Promotion`. *Supplementary:* `Supplementary Term → Add Offering (APPROVED+parity) → Demand → Window open → Student Supplementary Registration → Close Window → createSupplementarySection (faculty manual) → assignStudents`. Promotion never creates offerings; `PromotionService` reads `ExamRegistration` outcomes, not offerings.

Coordinators are canonical `Course.courseCoordinator` — no per-offering coordinator step; supplementary inherits.

### 4. Courses block now hosts Offerings + Sections + Placement; Registrations moves to Registration Tracking

Inside `AdminSemesterCourseBlock` per `Semester {n}` when supplementary:

1. **Offerings table** (exists) — per-row badges: `windowOpen` (from `useSupplementaryDemand`), `activeRegistrationCount`, `lastTaughtBy` muted hint distilled from Demand's `facultyByCourse`.
2. **Expand per offering → sections panel**: list `useSupplementarySections(termId)` filtered to `offeringId`, `Create Section` dialog `{name, facultyId}` with faculty picker, `Assign Students` multi-select bulk place (`POST /sections/:id/students` with `studentIds[]` → `studentSection.createMany`).
3. Batch-managed `PE/OE/PW`: expand shows offering info + "Section creation not available for batch-managed courses" — no button; server guard `isBatchManagedCourse` at `supplementary.service.ts:600` stays.

Demand's standalone 4-tab grid disappears; Registrations table **not** in this block — it moves to `Registration Tracking` as a `Supplementary Registrations` tab that calls kept `GET /admin/supplementary/registrations` via `useSupplementaryRegistrations(academicTermId,courseId?)` filtered by the page's `academicTermId` chain. Existing regular-tracking table (`getStudentRegistrationStatus` REGULAR) stays as default tab.

### 5. Manual faculty for supplementary sections

Delete `supplementary.service.ts:663-749` auto-inherit block (distinct `THEORY` `CourseAssignment` copy). Replace:

*Schema:* `CreateSupplementarySectionSchema: { name: string(min1 max50), facultyId: z.uuid() }` — single THEORY faculty.

*Validation:* `db.faculty.findUnique(facultyId)` exists + `faculty.departmentId === offering.course.departmentId` (same-department strict this cut).

*Storage:* single `db.courseAssignment.create({ courseId: offering.courseId, sectionId, facultyId, assignmentType:"THEORY", semester: hostSemester.semesterNumber, academicYear: hostYear })` — replaces loop, surfaces `P2002` as 409 not swallowed.

*Guards unchanged:* `isBatchManagedCourse` throw stays; window gate `607-633` (`hostSemester` lookup `programType+semesterNumber` inside supplementary term + `isRegistrationWindowOpen({SUPPLEMENTARY})` + `supplementaryWindowSettledMessage` blocking while open) stays; same gate at `940-966` for `assignStudents`. `supportWindow host findFirst {academicTermId, programType, semesterNumber}` + per-dept+cycle most-specific-wins (`registration-rules.ts:144-178`) stays.

### 6. Exam Registrations admin surface deleted

Delete all of: `apps/api/src/routers/admin/exam-registration.router.ts` + mount `admin.router.ts:67`, `controllers/admin/exam-registration.controller.ts`, `services/admin/exam-registration.service.ts`, `packages/schemas/src/admin/exam-registration.schema.ts` + export `admin/index.ts:17`, permission entries `examRegistration:["read"]` at `permissions.ts:25` and `:52`, `apps/web/app/(protected)/admin/exam-registrations/page.tsx`, `modules/admin/exam-registrations/` (view + `use-exam-registrations.ts`), sidebar entry `Exam Registrations → /admin/exam-registrations` (`sidebar-config.ts:170-173`).

*Stay:* `ExamRegistration` Prisma model (`schema.prisma:772-796`), `routers/student/exam-registration.router.ts`, `services/student/exam-registration.service.ts`, `promotion.service.ts:130-182`, `hall-ticket.service.ts:201-240,564-576`, `schemas/student/exam-registration.schema.ts`. Admin visibility covered by Registration Tracking.

### 7. Sidebar

Remove `Supplementary` and `Exam Registrations` entries from `Academics` in `sidebar-config.ts`. `Promotion` stays at `Academics → Promotion` (`:164`).

## Consequences

*Supplementary `CourseMapping` 403 disappears — faculty assigned at section create time per offering; no competing writer. `GET /admin/course/supplementary-candidates?parity` and `SupplementaryCourseOffering` parity/APPROVED guards remain the offering invariant (`FEATURE_DEPENDENCIES.md: §6`).
*`/admin/courses` per-semester blocks now read `useSupplementaryDemand` row badges + `useSupplementarySections` expands — one round-trip per term, client-filtered.
*`Registration Tracking` gains a supplementary tab with zero new backend — `SupplementaryRegistrationItem` shape reused.
*Hall ticket & promotion backlogs unaffected — they read `ExamRegistration REAPPEAR` + `CourseRegistration SUPPLEMENTARY` directly, not the deleted admin listing.
*Verification: `bun run lint → bun run check-types → bun run build` (pre-commit hook order `AGENTS.md: Commands`).

## Considered Options

*Keep Supplementary 4-tab page + add Offering in Courses (dual writers)* — rejected: duplicate CRUD, stale Demand confusion.
*Create supplementary sections via Course Mapping with `isSuperEdit`* — rejected: bypasses window gate and host-semester semantics, breaks `APPROVED` re-offer invariant.
*Keep Exam Registrations listing alongside Registration Tracking* — rejected: thin read-only over same `ExamRegistration` table already covered by Tracking.

## References

* `apps/api/src/services/department/course-assignment.service.ts:650-658`
* `apps/api/src/services/department/course.service.ts:824-836`, `:1177 approveSemesterCourses`
* `apps/web/modules/sidebar/sidebar-config.ts:108-187`
* `apps/web/modules/admin/courses/admin-semester-course-block.tsx:33-45`, `admin-supplementary-offering-block.tsx:1-218`, `admin/courses/admin-courses-view.tsx:340-351`
* `apps/api/src/services/admin/supplementary.service.ts:121-127,184-276,554-633,663-749,890-1046`
* `packages/schemas/src/admin/supplementary.schema.ts:23-25`
* `apps/api/src/services/shared/academic-rules/registration-rules.ts:144-178`
* `packages/db/prisma/schema.prisma:65,267-269,546,820-830,772-796`
* `apps/api/src/services/admin/promotion.service.ts:130-182`, `apps/api/src/services/shared/hall-ticket.service.ts:201-240`
