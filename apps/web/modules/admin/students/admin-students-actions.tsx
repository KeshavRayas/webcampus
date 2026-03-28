"use client";

import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AdminStudentResponseType } from "@webcampus/schemas/admin";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import { Eye } from "lucide-react";
import axios, { AxiosError } from "axios";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

type AdminStudentDetailResponse = {
  id: string;
  usn: string;
  departmentName: string;
  currentSemester: number;
  academicYear: string;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
    displayUsername?: string | null;
    image?: string | null;
    createdAt: string;
  };
  admission?: {
    applicationId?: string;
    modeOfAdmission?: string;
    status?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    primaryPhoneNumber?: string;
    secondaryPhoneNumber?: string;
    primaryEmail?: string;
    photo?: string;
    categoryClaimed?: string;
    categoryAllotted?: string;
    quota?: string;
    currentAddress?: string;
    currentArea?: string;
    currentCity?: string;
    currentDistrict?: string;
    currentState?: string;
    currentCountry?: string;
    currentPincode?: string;
    permanentAddress?: string;
    permanentArea?: string;
    permanentCity?: string;
    permanentDistrict?: string;
    permanentState?: string;
    permanentCountry?: string;
    permanentPincode?: string;
  } | null;
};

const DataField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-medium break-words">{value ?? "-"}</p>
    </div>
  );
};

export const AdminStudentActions = ({
  student,
}: {
  student: AdminStudentResponseType;
}) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["admin-student-details", student.id],
    queryFn: async () => {
      const response = await axios.get<{
        status: "success" | "error";
        data: AdminStudentDetailResponse;
      }>(`${NEXT_PUBLIC_API_BASE_URL}/admin/student/${student.id}`, {
        withCredentials: true,
      });

      return response.data.data;
    },
    enabled: isDetailsOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/student/${student.id}`,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success(`Student ${student.usn} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setIsDeleteOpen(false);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to delete student");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setIsDetailsOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            Delete Student
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="px-8 pt-8">
            <DialogTitle className="text-left text-2xl">
              Student Details
            </DialogTitle>
            <DialogDescription>USN: {student.usn}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-8 pb-8">
            {isLoadingDetails ? (
              <p className="text-muted-foreground py-6 text-sm">
                Loading student details...
              </p>
            ) : !details ? (
              <p className="text-muted-foreground py-6 text-sm">
                No additional details available.
              </p>
            ) : (
              <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_1fr]">
                <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6">
                  <Avatar className="h-28 w-28 border">
                    <AvatarImage
                      src={details.user.image || details.admission?.photo || undefined}
                      alt={details.user.name || "Student"}
                    />
                    <AvatarFallback>
                      {details.user.name
                        ?.split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "ST"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="w-full space-y-3 text-center">
                    <p className="text-lg font-semibold">{details.user.name}</p>
                    <p className="text-muted-foreground text-sm break-all">
                      {details.user.email}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {details.admission?.primaryPhoneNumber || "-"}
                    </p>
                  </div>

                  <div className="w-full space-y-3 border-t pt-4">
                    <DataField label="USN" value={details.usn} />
                    <DataField
                      label="Username"
                      value={details.user.username || "-"}
                    />
                    <DataField
                      label="Display Username"
                      value={details.user.displayUsername || "-"}
                    />
                    <DataField label="Department" value={details.departmentName} />
                    <DataField
                      label="Current Semester"
                      value={details.currentSemester}
                    />
                    <DataField label="Academic Year" value={details.academicYear} />
                  </div>
                </div>

                <div className="space-y-6">
                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">Account Details</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField label="Name" value={details.user.name} />
                      <DataField label="Email" value={details.user.email} />
                      <DataField
                        label="Username"
                        value={details.user.username || "-"}
                      />
                      <DataField
                        label="Display Username"
                        value={details.user.displayUsername || "-"}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">Admission Snapshot</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Application ID"
                        value={details.admission?.applicationId || "-"}
                      />
                      <DataField
                        label="Admission Mode"
                        value={details.admission?.modeOfAdmission || "-"}
                      />
                      <DataField
                        label="Admission Status"
                        value={details.admission?.status || "-"}
                      />
                      <DataField
                        label="Quota"
                        value={details.admission?.quota || "-"}
                      />
                      <DataField
                        label="Category Claimed"
                        value={details.admission?.categoryClaimed || "-"}
                      />
                      <DataField
                        label="Category Allotted"
                        value={details.admission?.categoryAllotted || "-"}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">Address</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Current Address"
                        value={[
                          details.admission?.currentAddress,
                          details.admission?.currentArea,
                          details.admission?.currentCity,
                          details.admission?.currentDistrict,
                          details.admission?.currentState,
                          details.admission?.currentCountry,
                          details.admission?.currentPincode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                      <DataField
                        label="Permanent Address"
                        value={[
                          details.admission?.permanentAddress,
                          details.admission?.permanentArea,
                          details.admission?.permanentCity,
                          details.admission?.permanentDistrict,
                          details.admission?.permanentState,
                          details.admission?.permanentCountry,
                          details.admission?.permanentPincode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{student.usn}</strong> ({student.name ?? "Unnamed"})? This
              will remove the student profile, their user account, all section
              assignments, course registrations, and marks. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
