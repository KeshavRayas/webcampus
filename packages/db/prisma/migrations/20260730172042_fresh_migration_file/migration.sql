-- CreateEnum
CREATE TYPE "DepartmentScopedRole" AS ENUM ('ADMIN', 'HOD', 'FACULTY', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "SemesterType" AS ENUM ('even', 'odd');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('UG', 'PG');

-- CreateEnum
CREATE TYPE "CourseMode" AS ENUM ('INTEGRATED', 'NON_INTEGRATED', 'FINAL_SUMMARY', 'NCMC');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('PC', 'PE', 'OE', 'NCMC');

-- CreateEnum
CREATE TYPE "CondonationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('THEORY', 'LAB');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('ASSOCIATE_PROFESSOR', 'ASSISTANT_PROFESSOR', 'PROFESSOR', 'VISITING_PROFESSOR');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('TEMPORARY', 'REGULAR', 'POP', 'ADJUNCT');

-- CreateEnum
CREATE TYPE "FacultyGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');

-- CreateEnum
CREATE TYPE "QualificationProgramType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "PublicationCategory" AS ENUM ('JOURNAL', 'CONFERENCE', 'BOOK_CHAPTER_OR_BOOK', 'CASE_STUDY', 'PATENT');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('GENERAL', 'OBC', 'SC', 'ST');

-- CreateEnum
CREATE TYPE "Quota" AS ENUM ('MERIT', 'MANAGEMENT', 'SPORTS', 'NRI', 'SNQ');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('DEGREE_GRANTING', 'BASIC_SCIENCES', 'SERVICE');

-- CreateEnum
CREATE TYPE "Cycle" AS ENUM ('PHYSICS', 'CHEMISTRY', 'NONE');

-- CreateEnum
CREATE TYPE "CourseApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "FreezeActorRole" AS ENUM ('FACULTY', 'HOD', 'ADMIN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('COURSE', 'COURSE_ASSIGNMENT', 'COORDINATOR', 'BATCH', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SUPER_EDIT', 'UPSERT_MAPPING', 'DELETE_MAPPING', 'UPDATE_COORDINATOR');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "role" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "type" "SemesterType" NOT NULL,
    "year" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "programType" "ProgramType" NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DepartmentType" NOT NULL DEFAULT 'DEGREE_GRANTING',

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationWindow" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "departmentId" TEXT,
    "cycle" "Cycle",
    "isOpen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistrationWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "role" "DepartmentScopedRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DepartmentUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentName" TEXT,
    "facultyId" TEXT,

    CONSTRAINT "Hod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentName" TEXT,
    "semesterId" TEXT NOT NULL,
    "cycle" "Cycle" NOT NULL DEFAULT 'NONE',
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSection" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,

    CONSTRAINT "StudentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usn" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "academicTermId" TEXT,
    "academicTermLabel" TEXT,
    "academicTermType" "SemesterType",
    "academicTermYear" TEXT,
    "programType" "ProgramType",
    "semesterId" TEXT,
    "semesterNumber" INTEGER,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designation" "Designation" NOT NULL,
    "shortName" TEXT NOT NULL,
    "aboutYourself" TEXT,
    "alternateContactNumber" TEXT,
    "bloodGroup" TEXT,
    "contactInformation" TEXT,
    "dateOfJoining" TIMESTAMP(3),
    "dob" TIMESTAMP(3),
    "employeeId" TEXT,
    "gender" "FacultyGender",
    "maritalStatus" "MaritalStatus",
    "mobileNumber" TEXT,
    "nationality" TEXT,
    "officeRoom" TEXT,
    "otherInformation" TEXT,
    "permanentAddressLine" TEXT,
    "permanentCity" TEXT,
    "permanentPincode" TEXT,
    "permanentState" TEXT,
    "personalEmail" TEXT,
    "phoneNumber" TEXT,
    "presentAddressLine" TEXT,
    "presentCity" TEXT,
    "presentPincode" TEXT,
    "presentState" TEXT,
    "profileUpdatedAt" TIMESTAMP(3),
    "qualification" TEXT,
    "researchArea" TEXT,
    "researchInterests" TEXT,
    "sameAsPresentAddress" BOOLEAN NOT NULL DEFAULT false,
    "staffType" "StaffType",

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyQualification" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "programType" "QualificationProgramType" NOT NULL,
    "yearPassed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyPublication" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "category" "PublicationCategory" NOT NULL,
    "publishedDate" TIMESTAMP(3) NOT NULL,
    "authors" TEXT NOT NULL,
    "publicationDetails" TEXT NOT NULL,
    "weblink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyExperience" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentName" TEXT,
    "departmentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "courseMode" "CourseMode" NOT NULL,
    "courseType" "CourseType" NOT NULL,
    "cycle" "Cycle" NOT NULL DEFAULT 'NONE',
    "lectureCredits" INTEGER NOT NULL DEFAULT 0,
    "tutorialCredits" INTEGER NOT NULL DEFAULT 0,
    "practicalCredits" INTEGER NOT NULL DEFAULT 0,
    "skillCredits" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL,
    "hasLaboratoryComponent" BOOLEAN NOT NULL DEFAULT false,
    "seeMaxMarks" INTEGER NOT NULL DEFAULT 0,
    "seeEligibility" INTEGER NOT NULL DEFAULT 40,
    "cieCount" INTEGER NOT NULL DEFAULT 0,
    "cieMaxMarks" INTEGER NOT NULL DEFAULT 0,
    "cieEligibility" INTEGER NOT NULL DEFAULT 40,
    "theoryMaxMarks" INTEGER NOT NULL DEFAULT 0,
    "theoryMinExams" INTEGER NOT NULL DEFAULT 0,
    "theoryEligibility" INTEGER NOT NULL DEFAULT 40,
    "labCount" INTEGER NOT NULL DEFAULT 0,
    "labMaxMarks" INTEGER NOT NULL DEFAULT 0,
    "labEligibility" INTEGER NOT NULL DEFAULT 40,
    "aatMaxMarks" INTEGER NOT NULL DEFAULT 0,
    "aatEligibility" INTEGER NOT NULL DEFAULT 40,
    "allowFeedback" BOOLEAN NOT NULL DEFAULT false,
    "attendanceRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "CourseApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByRole" TEXT,
    "approvedByUsername" TEXT,
    "approvedByDisplay" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revisionRequestedByRole" TEXT,
    "revisionNotes" TEXT,
    "revisionRequestedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastOverrideAt" TIMESTAMP(3),
    "lastOverrideById" TEXT,
    "overrideCount" INTEGER NOT NULL DEFAULT 0,
    "hasPostApprovalEdits" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "batchId" TEXT,
    "assignmentType" "AssignmentType" NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "CourseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "batchId" TEXT,
    "total" INTEGER NOT NULL,
    "present" INTEGER NOT NULL,
    "absent" INTEGER NOT NULL,
    "condonationStatus" "CondonationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cie1" DOUBLE PRECISION,
    "cie2" DOUBLE PRECISION,
    "cie3" DOUBLE PRECISION,
    "aat1" DOUBLE PRECISION,
    "aat2" DOUBLE PRECISION,
    "lab1" DOUBLE PRECISION,
    "lab2" DOUBLE PRECISION,
    "labTotal" DOUBLE PRECISION,
    "cieTotal" DOUBLE PRECISION,
    "status" "EligibilityStatus" NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Coe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Freeze" (
    "id" TEXT NOT NULL,
    "courseAssignmentId" TEXT NOT NULL,
    "cie1Frozen" BOOLEAN NOT NULL DEFAULT false,
    "cie2Frozen" BOOLEAN NOT NULL DEFAULT false,
    "cie3Frozen" BOOLEAN NOT NULL DEFAULT false,
    "cie1Deadline" TIMESTAMP(3),
    "cie2Deadline" TIMESTAMP(3),
    "cie3Deadline" TIMESTAMP(3),
    "facultyFrozen" BOOLEAN NOT NULL DEFAULT false,
    "hodFrozen" BOOLEAN NOT NULL DEFAULT false,
    "adminFrozen" BOOLEAN NOT NULL DEFAULT false,
    "facultyFrozenAt" TIMESTAMP(3),
    "hodFrozenAt" TIMESTAMP(3),
    "adminFrozenAt" TIMESTAMP(3),
    "finalFrozen" BOOLEAN NOT NULL DEFAULT false,
    "finalDeadline" TIMESTAMP(3),
    "frozenByRole" "FreezeActorRole",
    "frozenByUsername" TEXT,
    "frozenByDisplay" TEXT,

    CONSTRAINT "Freeze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallTicket" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,

    CONSTRAINT "HallTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "gender" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "fatherEmail" TEXT,
    "motherEmail" TEXT,
    "fatherNumber" TEXT,
    "motherNumber" TEXT,
    "class10thMarksPdf" TEXT,
    "class12thMarksPdf" TEXT,
    "hasClass12" BOOLEAN,
    "hasDiploma" BOOLEAN,
    "class10thSchoolName" TEXT,
    "modeOfAdmission" TEXT NOT NULL,
    "photo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT NOT NULL,
    "casteCertificate" TEXT,
    "semesterId" TEXT NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aadharCard" TEXT,
    "aadharNumber" TEXT,
    "bloodGroup" TEXT,
    "caste" TEXT,
    "class10thAggregateScore" DOUBLE PRECISION,
    "class10thAggregateTotal" DOUBLE PRECISION,
    "class10thMediumOfTeaching" TEXT,
    "class10thSchoolCity" TEXT,
    "class10thSchoolCode" TEXT,
    "class10thSchoolState" TEXT,
    "class10thSchoolType" TEXT,
    "class10thYearOfPassing" TEXT,
    "class12thAggregateScore" DOUBLE PRECISION,
    "class12thAggregateTotal" DOUBLE PRECISION,
    "class12thBranch" TEXT,
    "diplomaInstituteName" TEXT,
    "diplomaInstituteType" TEXT,
    "diplomaInstituteCity" TEXT,
    "diplomaInstituteState" TEXT,
    "diplomaInstituteCode" TEXT,
    "diplomaYearOfPassing" TEXT,
    "diplomaBranch" TEXT,
    "diplomaMediumOfTeaching" TEXT,
    "diplomaAggregateScore" DOUBLE PRECISION,
    "diplomaAggregateTotal" DOUBLE PRECISION,
    "diplomaMarksPdf" TEXT,
    "class12thInstituteCity" TEXT,
    "class12thInstituteCode" TEXT,
    "class12thInstituteName" TEXT,
    "class12thInstituteState" TEXT,
    "class12thInstituteType" TEXT,
    "class12thMediumOfTeaching" TEXT,
    "class12thYearOfPassing" TEXT,
    "currentAddress" TEXT,
    "currentArea" TEXT,
    "currentCity" TEXT,
    "currentCountry" TEXT,
    "currentDistrict" TEXT,
    "currentPincode" TEXT,
    "currentState" TEXT,
    "disability" BOOLEAN,
    "disabilityCertificate" TEXT,
    "disabilityType" TEXT,
    "dob" TIMESTAMP(3),
    "economicallyBackward" BOOLEAN,
    "economicallyBackwardCertificate" TEXT,
    "emergencyContactNumber" TEXT,
    "entranceExamRank" TEXT,
    "fatherQualification" TEXT,
    "fatherOccupation" TEXT,
    "fatherPermanentAddress" TEXT,
    "feePaid" DOUBLE PRECISION,
    "feePayable" DOUBLE PRECISION,
    "firstName" TEXT,
    "guardianEmail" TEXT,
    "guardianName" TEXT,
    "guardianNumber" TEXT,
    "guardianOccupation" TEXT,
    "guardianPermanentAddress" TEXT,
    "hostel" BOOLEAN,
    "hostelRoomNumber" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "motherQualification" TEXT,
    "motherOccupation" TEXT,
    "motherPermanentAddress" TEXT,
    "motherTongue" TEXT,
    "nameAsPer10th" TEXT,
    "nationality" TEXT,
    "nri" BOOLEAN,
    "originalAdmissionOrderDate" TIMESTAMP(3),
    "originalAdmissionOrderNumber" TEXT,
    "passportNumber" TEXT,
    "permanentAddress" TEXT,
    "permanentArea" TEXT,
    "permanentCity" TEXT,
    "permanentCountry" TEXT,
    "permanentDistrict" TEXT,
    "permanentPincode" TEXT,
    "permanentState" TEXT,
    "placeOfBirth" TEXT,
    "primaryEmail" TEXT,
    "primaryPhoneNumber" TEXT,
    "religion" TEXT,
    "secondaryEmail" TEXT,
    "secondaryPhoneNumber" TEXT,
    "stateOfBirth" TEXT,
    "studyCertificate" TEXT,
    "subCaste" TEXT,
    "tempUsn" TEXT,
    "transferCertificate" TEXT,
    "uniqueId" TEXT,
    "visaValidityDetails" TEXT,
    "departmentId" TEXT NOT NULL,
    "studentId" TEXT,
    "categoryAllotted" "Category" NOT NULL,
    "categoryClaimed" "Category" NOT NULL,
    "quota" "Quota" NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" "AttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "batchId" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timingCode" TEXT NOT NULL,
    "timingLabel" TEXT NOT NULL,
    "timingStartTime" TEXT NOT NULL,
    "timingEndTime" TEXT NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCoordinator" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,

    CONSTRAINT "CourseCoordinator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalMarks" INTEGER NOT NULL,

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "qNumber" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "co" TEXT,
    "po" TEXT,
    "bl" TEXT,
    "orGroupId" TEXT,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAssessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',

    CONSTRAINT "StudentAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQuestionMark" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StudentQuestionMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminEditLog" (
    "id" TEXT NOT NULL,
    "changeGroupId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "courseId" TEXT,
    "fieldName" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "action" "AuditAction" NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "adminUserId" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMappingAuditLog" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseMappingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BatchStudents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_type_year_key" ON "AcademicTerm"("type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicTermId_programType_semesterNumber_key" ON "Semester"("academicTermId", "programType", "semesterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_name_idx" ON "Department"("name");

-- CreateIndex
CREATE INDEX "RegistrationWindow_academicTermId_semesterId_idx" ON "RegistrationWindow"("academicTermId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationWindow_academicTermId_semesterId_departmentId_c_key" ON "RegistrationWindow"("academicTermId", "semesterId", "departmentId", "cycle");

-- CreateIndex
CREATE INDEX "DepartmentUser_departmentId_role_idx" ON "DepartmentUser"("departmentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentUser_userId_departmentId_role_key" ON "DepartmentUser"("userId", "departmentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Hod_userId_key" ON "Hod"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Hod_facultyId_key" ON "Hod"("facultyId");

-- CreateIndex
CREATE INDEX "Section_departmentId_semesterId_idx" ON "Section"("departmentId", "semesterId");

-- CreateIndex
CREATE INDEX "Section_departmentId_semesterId_cycle_idx" ON "Section"("departmentId", "semesterId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "Section_id_departmentId_key" ON "Section"("id", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_departmentId_semesterId_key" ON "Section"("name", "departmentId", "semesterId");

-- CreateIndex
CREATE INDEX "Batch_sectionId_idx" ON "Batch"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_sectionId_key" ON "Batch"("name", "sectionId");

-- CreateIndex
CREATE INDEX "StudentSection_studentId_idx" ON "StudentSection"("studentId");

-- CreateIndex
CREATE INDEX "StudentSection_sectionId_idx" ON "StudentSection"("sectionId");

-- CreateIndex
CREATE INDEX "StudentSection_sectionId_semester_academicYear_idx" ON "StudentSection"("sectionId", "semester", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSection_studentId_sectionId_semester_academicYear_key" ON "StudentSection"("studentId", "sectionId", "semester", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_usn_key" ON "Student"("usn");

-- CreateIndex
CREATE INDEX "Student_departmentName_idx" ON "Student"("departmentName");

-- CreateIndex
CREATE INDEX "Student_departmentName_currentSemester_idx" ON "Student"("departmentName", "currentSemester");

-- CreateIndex
CREATE INDEX "Student_semesterId_idx" ON "Student"("semesterId");

-- CreateIndex
CREATE INDEX "Student_semesterNumber_idx" ON "Student"("semesterNumber");

-- CreateIndex
CREATE INDEX "Student_programType_idx" ON "Student"("programType");

-- CreateIndex
CREATE INDEX "Student_academicTermId_idx" ON "Student"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_userId_key" ON "Faculty"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_employeeId_key" ON "Faculty"("employeeId");

-- CreateIndex
CREATE INDEX "Faculty_departmentId_idx" ON "Faculty"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_id_departmentId_key" ON "Faculty"("id", "departmentId");

-- CreateIndex
CREATE INDEX "FacultyQualification_facultyId_idx" ON "FacultyQualification"("facultyId");

-- CreateIndex
CREATE INDEX "FacultyPublication_facultyId_idx" ON "FacultyPublication"("facultyId");

-- CreateIndex
CREATE INDEX "FacultyExperience_facultyId_idx" ON "FacultyExperience"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_code_idx" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_idx" ON "Course"("departmentId", "semesterId");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_cycle_approvalStatus_idx" ON "Course"("departmentId", "semesterId", "cycle", "approvalStatus");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_semesterNumber_idx" ON "Course"("departmentId", "semesterId", "semesterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Course_id_departmentId_key" ON "Course"("id", "departmentId");

-- CreateIndex
CREATE INDEX "CourseAssignment_sectionId_semester_idx" ON "CourseAssignment"("sectionId", "semester");

-- CreateIndex
CREATE INDEX "CourseAssignment_departmentId_sectionId_semester_idx" ON "CourseAssignment"("departmentId", "sectionId", "semester");

-- CreateIndex
CREATE INDEX "CourseAssignment_departmentId_courseId_semester_idx" ON "CourseAssignment"("departmentId", "courseId", "semester");

-- CreateIndex
CREATE INDEX "CourseAssignment_courseId_semester_academicYear_idx" ON "CourseAssignment"("courseId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "CourseAssignment_facultyId_semester_academicYear_idx" ON "CourseAssignment"("facultyId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "CourseAssignment_batchId_idx" ON "CourseAssignment"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAssignment_departmentId_courseId_facultyId_sectionId__key" ON "CourseAssignment"("departmentId", "courseId", "facultyId", "sectionId", "batchId", "assignmentType", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "CourseRegistration_studentId_idx" ON "CourseRegistration"("studentId");

-- CreateIndex
CREATE INDEX "CourseRegistration_courseId_idx" ON "CourseRegistration"("courseId");

-- CreateIndex
CREATE INDEX "CourseRegistration_semesterId_idx" ON "CourseRegistration"("semesterId");

-- CreateIndex
CREATE INDEX "CourseRegistration_academicTermId_idx" ON "CourseRegistration"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_courseId_key" ON "CourseRegistration"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "Attendance_courseId_idx" ON "Attendance"("courseId");

-- CreateIndex
CREATE INDEX "Attendance_batchId_idx" ON "Attendance"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_courseId_batchId_key" ON "Attendance"("studentId", "courseId", "batchId");

-- CreateIndex
CREATE INDEX "Mark_courseId_idx" ON "Mark"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_studentId_courseId_key" ON "Mark"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Coe_userId_key" ON "Coe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Freeze_courseAssignmentId_key" ON "Freeze"("courseAssignmentId");

-- CreateIndex
CREATE INDEX "HallTicket_studentId_idx" ON "HallTicket"("studentId");

-- CreateIndex
CREATE INDEX "HallTicket_academicTermId_idx" ON "HallTicket"("academicTermId");

-- CreateIndex
CREATE INDEX "HallTicket_semesterId_idx" ON "HallTicket"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_studentId_academicTermId_semesterId_key" ON "HallTicket"("studentId", "academicTermId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_applicationId_key" ON "Admission"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_aadharNumber_key" ON "Admission"("aadharNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_primaryEmail_key" ON "Admission"("primaryEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_tempUsn_key" ON "Admission"("tempUsn");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_uniqueId_key" ON "Admission"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_studentId_key" ON "Admission"("studentId");

-- CreateIndex
CREATE INDEX "Admission_semesterId_idx" ON "Admission"("semesterId");

-- CreateIndex
CREATE INDEX "Admission_departmentId_idx" ON "Admission"("departmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_batchId_idx" ON "AttendanceRecord"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "ClassSession_courseId_idx" ON "ClassSession"("courseId");

-- CreateIndex
CREATE INDEX "ClassSession_sectionId_idx" ON "ClassSession"("sectionId");

-- CreateIndex
CREATE INDEX "ClassSession_batchId_idx" ON "ClassSession"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_courseId_sectionId_sessionDate_timingCode_batc_key" ON "ClassSession"("courseId", "sectionId", "sessionDate", "timingCode", "batchId");

-- CreateIndex
CREATE INDEX "CourseCoordinator_courseId_idx" ON "CourseCoordinator"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCoordinator_courseId_facultyId_key" ON "CourseCoordinator"("courseId", "facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAssessment_studentId_assessmentId_key" ON "StudentAssessment"("studentId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentQuestionMark_recordId_questionId_key" ON "StudentQuestionMark"("recordId", "questionId");

-- CreateIndex
CREATE INDEX "AdminEditLog_entityType_entityId_idx" ON "AdminEditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminEditLog_changeGroupId_idx" ON "AdminEditLog"("changeGroupId");

-- CreateIndex
CREATE INDEX "AdminEditLog_courseId_idx" ON "AdminEditLog"("courseId");

-- CreateIndex
CREATE INDEX "AdminEditLog_editedAt_idx" ON "AdminEditLog"("editedAt");

-- CreateIndex
CREATE INDEX "AdminEditLog_adminUserId_idx" ON "AdminEditLog"("adminUserId");

-- CreateIndex
CREATE INDEX "CourseMappingAuditLog_courseId_idx" ON "CourseMappingAuditLog"("courseId");

-- CreateIndex
CREATE INDEX "CourseMappingAuditLog_adminId_idx" ON "CourseMappingAuditLog"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "_BatchStudents_AB_unique" ON "_BatchStudents"("A", "B");

-- CreateIndex
CREATE INDEX "_BatchStudents_B_index" ON "_BatchStudents"("B");

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationWindow" ADD CONSTRAINT "RegistrationWindow_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationWindow" ADD CONSTRAINT "RegistrationWindow_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationWindow" ADD CONSTRAINT "RegistrationWindow_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentUser" ADD CONSTRAINT "DepartmentUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentUser" ADD CONSTRAINT "DepartmentUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hod" ADD CONSTRAINT "Hod_departmentName_fkey" FOREIGN KEY ("departmentName") REFERENCES "Department"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hod" ADD CONSTRAINT "Hod_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hod" ADD CONSTRAINT "Hod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSection" ADD CONSTRAINT "StudentSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSection" ADD CONSTRAINT "StudentSection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentName_fkey" FOREIGN KEY ("departmentName") REFERENCES "Department"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyQualification" ADD CONSTRAINT "FacultyQualification_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyPublication" ADD CONSTRAINT "FacultyPublication_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyExperience" ADD CONSTRAINT "FacultyExperience_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_courseId_departmentId_fkey" FOREIGN KEY ("courseId", "departmentId") REFERENCES "Course"("id", "departmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_sectionId_departmentId_fkey" FOREIGN KEY ("sectionId", "departmentId") REFERENCES "Section"("id", "departmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coe" ADD CONSTRAINT "Coe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Freeze" ADD CONSTRAINT "Freeze_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "CourseAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallTicket" ADD CONSTRAINT "HallTicket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallTicket" ADD CONSTRAINT "HallTicket_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallTicket" ADD CONSTRAINT "HallTicket_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCoordinator" ADD CONSTRAINT "CourseCoordinator_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCoordinator" ADD CONSTRAINT "CourseCoordinator_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssessment" ADD CONSTRAINT "StudentAssessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionMark" ADD CONSTRAINT "StudentQuestionMark_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "StudentAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionMark" ADD CONSTRAINT "StudentQuestionMark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminEditLog" ADD CONSTRAINT "AdminEditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMappingAuditLog" ADD CONSTRAINT "CourseMappingAuditLog_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMappingAuditLog" ADD CONSTRAINT "CourseMappingAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchStudents" ADD CONSTRAINT "_BatchStudents_A_fkey" FOREIGN KEY ("A") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchStudents" ADD CONSTRAINT "_BatchStudents_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
