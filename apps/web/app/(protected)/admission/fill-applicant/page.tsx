import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";

export default async function FillApplicantPage({
  searchParams,
}: {
  searchParams: Promise<{
    semester?: string;
    email?: string;
    applicationId?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  return (
    <ApplicantAdmissionView
      staffMode
      initialSemesterId={params.semester}
      initialEmail={params.email}
      initialApplicationId={params.applicationId}
    />
  );
}
