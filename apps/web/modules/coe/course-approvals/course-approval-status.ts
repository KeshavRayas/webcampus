export type SubmissionApprovalStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "NEEDS_REVISION";

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
const DRAFT_BADGE_CLASSNAME = "border-slate-200 bg-slate-50 text-slate-600";
const NEEDS_REVISION_BADGE_CLASSNAME = "border-red-200 bg-red-50 text-red-700";

export const getApprovalBadgeConfig = (
  input: ApprovalFlagsInput
): ApprovalBadgeConfig => {
  if (input.approvalStatus === "DRAFT") {
    return {
      label: "Draft",
      variant: "outline",
      className: DRAFT_BADGE_CLASSNAME,
    };
  }

  if (input.approvalStatus === "NEEDS_REVISION") {
    return {
      label: "Needs Revision",
      variant: "outline",
      className: NEEDS_REVISION_BADGE_CLASSNAME,
    };
  }

  if (input.approvalStatus === "PENDING") {
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
