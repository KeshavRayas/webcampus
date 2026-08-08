import { ApplicantAdmissionView } from "@/modules/admission/applicant/applicant-admission-view";

export default async function FillApplicantPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>;
}) {
  const { semester } = (await searchParams) ?? {};
  return <ApplicantAdmissionView staffMode initialSemesterId={semester} />;
}
