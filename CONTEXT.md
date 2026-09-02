# Webcampus — Academic Lifecycle

A VTU-aligned academic platform that configures courses, maps faculty, collects attendance/marks, and runs promotion, registration, and hall-ticket flows across odd/even/supplementary terms.

## Language

### Terms

**AcademicTerm**:
A year-bound term with `type ∈ {odd, even, supplementary}` + `parity {odd, even}` when supplementary. Owns semesters, windows, registrations.
_Avoid_: session, year-type

**Semester**:
A numbered container (`1..8`) inside an AcademicTerm per `programType {UG, PG}`. Holds courses and sections.
_Avoid_: sem, year-semester

**Course**:
Canonical definition `{code, name, credits L-T-P-S, assessment, courseMode, courseType, departmentId, semesterId, cycle}` with `approvalStatus {DRAFT → PENDING → APPROVED, NEEDS_REVISION}`.
_Avoid_: subject, offering, supplementary-course

**Locked Course**:
A course whose `approvalStatus ∈ {PENDING, APPROVED}` — faculty/coordinator edits are blocked except via admin `isSuperEdit` with reason + version.
_Avoid_: frozen, closed

**SupplementaryCourseOffering**:
Term-scoped link `academicTermId (supplementary) + courseId (APPROVED canonical)` — re-offers an existing course without copying its definition. Parity must match `semesterNumber %2`.
_Avoid_: supplementary course, copied course, "-S" course

**CourseConfiguration**:
Creating the canonical Course in Courses (regular terms) or creating a SupplementaryCourseOffering via the Add Offering picker when `term.type === supplementary`.
_Avoid_: course creation (overloaded), offerings in configuration

**Course Mapping**:
Faculty-to-section/batch assignment `{courseId, sectionId/batchId, facultyId, assignmentType}` managed only in Course Mapping, never in Courses.
_Avoid_: faculty allocation, teaching assignment

**Appoint Coordinators**:
Assigning `CourseCoordinator {courseId, facultyId}` — part of canonical Course, before submission. Inherited by supplementary offerings.
_Avoid_: coordinator mapping, course in-charge

**Section**:
Physical teaching section `{departmentId, semesterId, registrationType {REGULAR, SUPPLEMENTARY}, supplementaryOfferingId?, cycle}` created after registration window is settled.
_Avoid_: class, batch (batch is distinct)

**Batch / ElectiveBatch**:
Sub-group within a Section/Batch-managed course. `PE/OE/PW` use `ElectiveBatch + ElectiveBatchFaculty`; labs use `Batch`.
_Avoid_: group, sub-section

**Host Semester**:
The `Semester` row inside a supplementary AcademicTerm looked up by `{academicTermId, programType, semesterNumber}` that hosts supplementary sections.
_Avoid_: supplementary semester, offering semester

**RegistrationWindow**:
Per-scope window `{academicTermId, semesterId, departmentId?, cycle?, registrationType, isOpen, startsAt/endsAt}` evaluated by `isRegistrationWindowOpen` with most-specific-wins.
_Avoid_: window, enrollment period

**Registration Type**:
`{REGULAR, RE_REGISTRATION, SUPPLEMENTARY}` on windows, sections, and `CourseRegistration`.
_Avoid_: registration kind

**CourseRegistration**:
Student enrollment `{studentId, courseId, academicTermId, registrationType, status {ACTIVE}}` — supplementary registrations are `registrationType=SUPPLEMENTARY`.
_Avoid_: course enrollment, student course

**ExamRegistration**:
Backlog/exam attempt `{studentId, courseId, academicTermId, examType {REAPPEAR}, status, outcome}` used for promotion, hall tickets, and backlog detection. Distinct from `CourseRegistration`.
_Avoid_: exam enrollment, supplementary registration

**Promotion**:
Advancing `Student {semesterId, academicTermId, currentSemester}` and recording `StudentPromotion {from→to}` after backlog evaluation via `ExamRegistration` outcomes.
_Avoid_: year promotion, semester upgrade

**Window-Settled Gate**:
`supplementaryWindowSettledMessage` — blocks `createSupplementarySection` and `assignStudents` while `isRegistrationWindowOpen` is true.
_Avoid_: window closed check, freeze gate

**Elective / Project Mapping**:
Faculty mapping for `PE/OE/PW` via `ElectiveBatchFaculty` — batch-managed, never section-based. Blocked for supplementary section creation.
_Avoid_: elective section, project section

**Coordinator Inheritance**:
Supplementary offerings reuse the canonical `Course.courseCoordinator` — no per-offering coordinator step.
_Avoid_: supplementary coordinator
