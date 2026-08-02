import { Role } from "@webcampus/types/rbac";
import {
  BookCopy,
  BookOpenText,
  Building,
  CalendarDays,
  ClipboardList,
  FileText,
  Fingerprint,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Lock,
  Send,
  User,
  Users,
  UserSearch,
} from "lucide-react";
import { NavSecondaryProps, SidebarData } from "./sidebar-types";

const navSecondary: NavSecondaryProps = {
  items: [
    {
      title: "Support",
      url: "/support",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: Send,
    },
  ],
};

export const sidebarConfig: Record<Role, SidebarData> = {
  admin: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/admin",
          icon: LayoutDashboard,
        },
        {
          name: "Department",
          url: "/admin/department",
          icon: Building,
        },
        {
          name: "Semester",
          url: "/admin/semester",
          icon: CalendarDays,
        },
        {
          name: "Faculty",
          url: "/admin/faculty",
          icon: Users,
        },
        {
          name: "Users",
          url: "/admin/admission-users",
          icon: Users,
          children: [
            { name: "Admission Users", url: "/admin/admission-users" },
            { name: "COE Users", url: "/admin/coe" },
          ],
        },
        {
          name: "Students",
          url: "/admin/students",
          icon: GraduationCap,
        },
        {
          name: "Courses",
          url: "/admin/courses",
          icon: Library,
          children: [
            { name: "Course Configuration", url: "/admin/courses" },
            { name: "Course Mapping", url: "/admin/course-mapping" },
            { name: "Appoint Coordinators", url: "/admin/course-coordinators" },
            { name: "Course Approvals", url: "/admin/course-approvals" },
            {
              name: "Registration Windows",
              url: "/admin/registration-windows",
            },
            {
              name: "Registration Tracking",
              url: "/admin/registration-tracking",
            },
          ],
        },
        {
          name: "Academics",
          url: "/admin/academics/freezing",
          icon: GraduationCap,
          children: [
            {
              name: "Freezing",
              url: "/admin/academics/freezing",
            },
            {
              name: "Attendance",
              url: "/admin/academics/attendance",
            },
            {
              name: "Marks",
              url: "/admin/academics/marks",
            },
            {
              name: "Condonation",
              url: "/admin/academics/condonation",
            },
            {
              name: "Hall Tickets",
              url: "/admin/academics/hall-ticket",
            },
          ],
        },
      ],
    },
    navSecondary,
  },
  department: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/department",
          icon: LayoutDashboard,
        },
        {
          name: "Faculty",
          url: "/department/faculty",
          icon: Users,
        },
        {
          name: "Student",
          url: "/department/student",
          icon: GraduationCap,
        },
        {
          name: "Courses",
          url: "/department/courses",
          icon: Library,
          children: [
            { name: "Course Configuration", url: "/department/courses" },
            { name: "Course Mapping", url: "/department/course-mapping" },
            {
              name: "Appoint Coordinators",
              url: "/department/course-coordinators",
            },
            { name: "Approvals", url: "/department/course-approvals" },
          ],
        },
        {
          name: "Sections",
          url: "/department/sections",
          icon: UserSearch,
        },
      ],
    },
    navSecondary,
  },
  student: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/student",
          icon: LayoutDashboard,
        },
        {
          name: "Courses",
          url: "/student/courses",
          icon: BookCopy,
          children: [{ name: "Course Registration", url: "/student/courses" }],
        },
        {
          name: "Attendance",
          url: "/student/attendance",
          icon: Fingerprint,
          children: [
            { name: "View Attendance", url: "/student/attendance" },
            { name: "Attendance Report", url: "/student/attendance/report" },
          ],
        },
        {
          name: "CIE",
          url: "/student/cie",
          icon: BookOpenText,
        },
        {
          name: "Hall Ticket",
          url: "/student/hall-ticket",
          icon: FileText,
        },
        {
          name: "Profile",
          url: "/student/profile",
          icon: User,
        },
      ],
    },
    navSecondary,
  },
  faculty: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/faculty",
          icon: LayoutDashboard,
        },
        {
          name: "Handling",
          url: "/faculty/handling/courses",
          icon: GraduationCap,
          children: [
            { name: "Courses", url: "/faculty/handling/courses" },
            { name: "Lab", url: "/faculty/handling/lab" },
          ],
        },
        {
          name: "Freezing",
          url: "/faculty/freezing",
          icon: Lock,
        },
        {
          name: "Attendance",
          url: "/faculty/attendance/take",
          icon: Fingerprint,
          children: [
            { name: "Take Attendance", url: "/faculty/attendance/take" },
            { name: "Edit Attendance", url: "/faculty/attendance/edit" },
            { name: "Attendance Report", url: "/faculty/attendance/report" },
          ],
        },
        {
          name: "Marks",
          url: "/faculty/marks",
          icon: BookOpenText,
          children: [
            { name: "Enter Marks", url: "/faculty/marks" },
            { name: "Marks Report", url: "/faculty/marks/report" },
          ],
        },
        {
          name: "Question Paper Setup",
          url: "/faculty/question-paper-setup",
          icon: ClipboardList,
        },
        {
          name: "Profile",
          url: "/faculty/profile",
          icon: User,
        },
      ],
    },
    navSecondary,
  },
  hod: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/hod",
          icon: LayoutDashboard,
        },
        {
          name: "Faculty",
          url: "/hod/faculty",
          icon: Users,
        },
        {
          name: "Courses",
          url: "/hod/courses",
          icon: GraduationCap,
        },
        {
          name: "Academics",
          url: "/hod/academics/freezing",
          icon: GraduationCap,
          children: [
            {
              name: "Freezing",
              url: "/hod/academics/freezing",
            },
            {
              name: "Attendance",
              url: "/hod/academics/attendance",
            },
            {
              name: "Marks",
              url: "/hod/academics/marks",
            },
            {
              name: "Condonation",
              url: "/hod/academics/condonation",
            },
          ],
        },
        {
          name: "Reports",
          url: "/hod/reports",
          icon: BookOpenText,
        },
        {
          name: "Profile",
          url: "/hod/profile",
          icon: User,
        },
      ],
    },
    navSecondary,
  },
  coordinator: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/coordinator",
          icon: LayoutDashboard,
        },
        {
          name: "Events",
          url: "/coordinator/events",
          icon: BookCopy,
        },
        {
          name: "Students",
          url: "/coordinator/students",
          icon: Users,
        },
        {
          name: "Reports",
          url: "/coordinator/reports",
          icon: BookOpenText,
        },
        {
          name: "Profile",
          url: "/coordinator/profile",
          icon: User,
        },
      ],
    },
    navSecondary,
  },
  coe: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/coe",
          icon: LayoutDashboard,
        },
        {
          name: "Approvals",
          url: "/coe/course-approvals",
          icon: Library,
        },
        {
          name: "Examinations",
          url: "/coe/examinations",
          icon: BookOpenText,
        },
        {
          name: "Results",
          url: "/coe/results",
          icon: GraduationCap,
        },
        {
          name: "Reports",
          url: "/coe/reports",
          icon: Fingerprint,
        },
        {
          name: "Profile",
          url: "/coe/profile",
          icon: User,
        },
      ],
    },
    navSecondary,
  },
  finance: {
    navMain: {
      items: [
        {
          name: "Finance",
          url: "/finance",
          icon: IndianRupee,
        },
      ],
    },
    navSecondary,
  },
  admission_admin: {
    navMain: {
      items: [
        {
          name: "Add Admissions",
          url: "/admission",
          icon: LayoutDashboard,
        },
        {
          name: "View Admissions",
          url: "/admission/view-admissions",
          icon: BookCopy,
        },
        {
          name: "Leave College",
          url: "/admission/leave-college",
          icon: GraduationCap,
        },
        {
          name: "Change Admission Mode",
          url: "/admission/change-mode",
          icon: BookCopy,
        },
      ],
    },
    navSecondary,
  },

  applicant: {
    navMain: {
      items: [
        {
          name: "My Application",
          url: "/applicant",
          icon: BookOpenText,
        },
      ],
    },
    navSecondary,
  },
} as const;
