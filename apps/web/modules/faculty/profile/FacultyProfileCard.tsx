import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
import { DataField } from "./data-field";
import { FacultyProfilePayload } from "./use-faculty-profile";

const getInitials = (name?: string | null) => {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) {
    return (parts[0] || "NA").slice(0, 2).toUpperCase();
  }
  const first = parts[0] || "N";
  const second = parts[1] || "A";
  return `${first[0] || "N"}${second[0] || "A"}`.toUpperCase();
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const FacultyProfileCard = ({
  profile,
}: {
  profile: FacultyProfilePayload;
}) => {
  return (
    <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6 lg:w-[18rem]">
      <Avatar className="h-28 w-28 border">
        <AvatarImage src={profile.user.image || undefined} alt={profile.user.name} />
        <AvatarFallback className="text-xl font-semibold">
          {getInitials(profile.user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="w-full space-y-3 text-center">
        <p className="text-lg font-semibold">{profile.user.name}</p>
        <p className="text-muted-foreground text-sm break-all">{profile.user.email}</p>
        <p className="text-muted-foreground text-sm">{profile.employeeId || "-"}</p>
      </div>

      <div className="w-full space-y-3 border-t pt-4">
        <DataField label="Department" value={profile.department?.name} />
        <DataField
          label="Designation"
          value={profile.designation
            ?.split("_")
            .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
            .join(" ")}
        />
        <DataField label="Joining Date" value={formatDate(profile.dateOfJoining)} />
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Status</p>
          <Badge variant="default">Active</Badge>
        </div>
      </div>
    </div>
  );
};
