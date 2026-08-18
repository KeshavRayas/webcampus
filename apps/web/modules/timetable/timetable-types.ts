export type TimetableEntry = {
  id: string;
  academicYear: string;
  semesterId: string;
  courseId: string;
  facultyId: string;
  roomNumber: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classType: string;
  status: string;
  course?: { code?: string; name?: string } | null;
  faculty?: {
    shortName?: string;
    user?: { name?: string | null } | null;
  } | null;
  section?: { name?: string } | null;
};

export type TimetableSlot = {
  label: string;
  startTime: string;
  endTime: string;
};

export type TimetableResponse = {
  status: "success" | "error";
  data?: TimetableEntry[];
  message?: string;
};

export type TimetableTemplate = {
  courses: Array<{ id: string; code: string; name: string }>;
  sections: Array<{ id: string; name: string }>;
  faculty: Array<{
    id: string;
    shortName: string;
    user?: { name?: string | null } | null;
  }>;
  rooms: string[];
};
