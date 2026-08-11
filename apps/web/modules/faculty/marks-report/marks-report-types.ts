export interface MarksReportFilters extends Record<string, string> {
  academicTermId: string;
  programType: string;
  semesterId: string;
  courseId: string;
  sectionId: string;
  assessmentId: string;
}

export interface MarksReportStudentScore {
  assessmentId: string;
  assessmentTitle: string;
  totalMarks: number | null;
  maxMarks: number;
  questionMarks?: Record<string, number>;
}

export interface MarksReportStudent {
  usn: string;
  name: string;
  assessments: MarksReportStudentScore[];
  cieTotal: number | null;
  status: string;
}

export interface MarksReportData {
  course: {
    id: string;
    code: string;
    name: string;
    cieMinMarks: number;
    cieEligibilityPercent: number;
  };
  assessments: Array<{
    id: string;
    title: string;
    totalMarks: number;
    componentType?: string;
    questions?: Array<{
      id: string;
      part: string;
      qNumber: string;
      marks: number;
    }>;
  }>;
  semester: {
    id: string;
    semesterNumber: number;
    academicTerm: {
      id: string;
      type: string;
      year: string;
    };
  };
  students: MarksReportStudent[];
}

export interface MarksReportFilterOption {
  id: string;
  code: string;
  name: string;
  sectionId: string;
  sectionName: string;
  semesterId: string;
}

export interface MarksReportFilterOptionsData {
  courses: MarksReportFilterOption[];
  assessments: Array<{
    id: string;
    title: string;
    courseId: string;
  }>;
}
