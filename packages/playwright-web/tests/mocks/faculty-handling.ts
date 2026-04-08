export const facultyHandlingAssignmentsMock = {
  status: "success",
  message: "Faculty handling assignments fetched successfully",
  data: {
    data: [
      {
        assignmentId: "asgn-theory-1",
        id: "asgn-theory-1",
        courseId: "course-1",
        courseCode: "CS301",
        courseName: "Algorithms",
        section: "A",
        semesterNumber: 3,
        studentCount: 48,
      },
      {
        assignmentId: "asgn-theory-2",
        id: "asgn-theory-2",
        courseId: "course-2",
        courseCode: "CS302",
        courseName: "Operating Systems",
        section: "A",
        semesterNumber: 3,
        studentCount: 47,
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
    },
  },
};

export const facultyHandlingLabAssignmentsMock = {
  status: "success",
  message: "Faculty handling assignments fetched successfully",
  data: {
    data: [
      {
        assignmentId: "asgn-lab-1",
        id: "asgn-lab-1",
        courseId: "course-lab-1",
        courseCode: "CSL37",
        courseName: "Algorithms Lab",
        section: "A",
        semesterNumber: 3,
        studentCount: 24,
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
    },
  },
};

export const facultyHandlingStudentsMock = {
  status: "success",
  message: "Students for faculty assignment fetched successfully",
  data: {
    data: [
      {
        id: "stu-1",
        usn: "1BM22CS001",
        studentName: "Alice",
        email: "alice@example.com",
        section: "A",
        semesterNumber: 3,
      },
      {
        id: "stu-2",
        usn: "1BM22CS002",
        studentName: "Bob",
        email: "bob@example.com",
        section: "A",
        semesterNumber: 3,
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
    },
  },
};
