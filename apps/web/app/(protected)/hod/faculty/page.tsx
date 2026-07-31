import { HodFacultyView } from "@/modules/hod/faculty/hod-faculty-view";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "HOD - Department Faculty | WebCampus",
};

export default function HodFacultyPage() {
  return <HodFacultyView />;
}
