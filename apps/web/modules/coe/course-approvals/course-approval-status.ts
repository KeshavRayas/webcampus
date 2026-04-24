export type SubmissionApprovalStatus = "PENDING" | "APPROVED";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface ApprovalBadgeConfig {
  label: string;
  variant: BadgeVariant;
  className?: string;
}

interface ApprovalFlagsInput {
  approvalStatus: SubmissionApprovalStatus;
  hasAdminApproved: boolean;
  hasCoeApproved: boolean;
}

const APPROVED_BADGE_CLASSNAME =
  "border-emerald-200 bg-emerald-50 text-emerald-700";
const PENDING_BADGE_CLASSNAME = "border-amber-300 bg-amber-50 text-amber-800";

export const getApprovalBadgeConfig = (
  input: ApprovalFlagsInput
): ApprovalBadgeConfig => {
  if (input.approvalStatus !== "APPROVED") {
    return {
      label: "Pending Review",
      variant: "outline",
      className: PENDING_BADGE_CLASSNAME,
    };
  }

  if (input.hasAdminApproved) {
    return {
      label: "Approved by Admin",
      variant: "secondary",
      className: APPROVED_BADGE_CLASSNAME,
    };
  }

  if (input.hasCoeApproved) {
    return {
      label: "Approved by COE",
      variant: "secondary",
      className: APPROVED_BADGE_CLASSNAME,
    };
  }

  return {
    label: "Approved",
    variant: "secondary",
    className: APPROVED_BADGE_CLASSNAME,
  };
};

export const isSubmissionApproved = (
  approvalStatus: SubmissionApprovalStatus
): boolean => approvalStatus === "APPROVED";
