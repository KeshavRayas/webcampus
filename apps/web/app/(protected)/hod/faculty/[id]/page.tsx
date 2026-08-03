import { FacultyProfileView } from "@/modules/faculty/profile/faculty-profile-view";
import { Button } from "@webcampus/ui/components/button";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HOD - View Faculty Profile | WebCampus",
};

export default async function HodViewFacultyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Page>
      <PageHeader title="Faculty Profile">
        <p className="text-muted-foreground text-sm">
          View details of the faculty member.
        </p>
        <div className="mt-4">
          <Link href="/hod/faculty">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Faculty List
            </Button>
          </Link>
        </div>
      </PageHeader>
      <PageContent>
        <FacultyProfileView facultyId={id} />
      </PageContent>
    </Page>
  );
}
