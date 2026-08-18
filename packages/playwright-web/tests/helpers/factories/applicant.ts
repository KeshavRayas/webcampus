let _seq = 0;

export type MakeApplicantInput = {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  category?: "GENERAL" | "OBC" | "SC" | "ST";
  quota?: "MERIT" | "MANAGEMENT" | "SPORTS" | "NRI" | "SNQ";
  fatherName?: string;
  motherName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  graduationPercentage?: number;
  preferredBranch?: string;
};

export function makeApplicant(overrides: Partial<MakeApplicantInput> = {}) {
  _seq++;
  const seq = String(_seq).padStart(3, "0");
  return {
    name: overrides.name ?? `Test${seq} Applicant${seq}`,
    email: overrides.email ?? `applicant${seq}@test.com`,
    phone: overrides.phone ?? `9876543${String(_seq).padStart(4, "0")}`,
    dateOfBirth: overrides.dateOfBirth ?? "2000-01-15",
    gender: overrides.gender ?? "MALE",
    category: overrides.category ?? "GENERAL",
    quota: overrides.quota ?? "MANAGEMENT",
    fatherName: overrides.fatherName ?? `Father ${seq}`,
    motherName: overrides.motherName ?? `Mother ${seq}`,
    address: overrides.address ?? `${seq} Test Street`,
    city: overrides.city ?? "Bangalore",
    state: overrides.state ?? "Karnataka",
    pincode: overrides.pincode ?? "560001",
    tenthPercentage: overrides.tenthPercentage ?? 85,
    twelfthPercentage: overrides.twelfthPercentage ?? 80,
    graduationPercentage: overrides.graduationPercentage ?? 75,
    preferredBranch: overrides.preferredBranch ?? "CS",
  };
}
