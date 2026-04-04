import { Role } from "@webcampus/types/rbac";
import {
  BookCopy,
  BookOpenText,
  Building,
  CalendarDays,
  Fingerprint,
  GraduationCap,
  LayoutDashboard,
  Library,
  LifeBuoy,
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
            { name: "Course Approvals", url: "/admin/course-approvals" },
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
        },
        {
          name: "Attendance",
          url: "/student/attendance",
          icon: Fingerprint,
        },
        {
          name: "CIE",
          url: "/student/cie",
          icon: BookOpenText,
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
          name: "Courses",
          url: "/faculty/courses",
          icon: GraduationCap,
        },
        {
          name: "Students",
          url: "/faculty/students",
          icon: Users,
        },
        {
          name: "Attendance",
          url: "/faculty/attendance",
          icon: Fingerprint,
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
  admission_admin: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/admission",
          icon: LayoutDashboard,
        },
        {
          name: "View Admissions",
          url: "/admission/view-admissions",
          icon: BookCopy,
        },
      ],
    },
    navSecondary,
  },
  admission_reviewer: {
    navMain: {
      items: [
        {
          name: "Dashboard",
          url: "/admission",
          icon: LayoutDashboard,
        },
        {
          name: "View Admissions",
          url: "/admission/view-admissions",
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
