import { HodCoursesView } from "@/modules/hod/courses/hod-courses-view";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "HOD - Department Courses | WebCampus",
};

export default function HodCoursesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HodCoursesView />
    </Suspense>
  );
}
