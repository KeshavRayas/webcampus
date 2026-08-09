import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";

export default async function FillApplicantFormPage({
  searchParams,
}: {
  searchParams: Promise<{
    semester?: string;
    email?: string;
    applicationId?: string;
  }>;
}) {
  const { semester, email, applicationId } = (await searchParams) ?? {};
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Fill Applicant Form
        </h1>
        <p className="text-muted-foreground text-sm">
          Fill and submit the admission application for an applicant.
        </p>
      </div>
      <ApplicantAdmissionView
        staffMode
        initialSemesterId={semester}
        initialEmail={email}
        initialApplicationId={applicationId}
      />
    </div>
  );
}
