import { FacultyProfileView } from "@/modules/faculty/profile/faculty-profile-view";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "HOD - Profile | WebCampus",
};

export default function HodProfilePage() {
  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">HOD Profile</h1>
        <p className="text-muted-foreground text-sm">
          Manage your personal information, qualifications, publications, and
          experience.
        </p>
      </header>
      <FacultyProfileView />
    </div>
  );
}
