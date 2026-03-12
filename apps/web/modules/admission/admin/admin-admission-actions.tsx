"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import { Eye, MoreHorizontal } from "lucide-react";
import React, { useState } from "react";
import { AdmissionResponse } from "./admin-admission-columns";
import { useAdmissionDelete } from "./use-admission-delete";

const getStatusVariant = (status: AdmissionResponse["status"]) => {
  if (status === "APPROVED") return "default" as const;
  if (status === "SUBMITTED") return "secondary" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "outline" as const;
};

const getInitials = (name?: string | null) => {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "NA";
  if (parts.length === 1) return (parts[0] ?? "NA").slice(0, 2).toUpperCase();
  const firstInitial = parts[0]?.[0] ?? "N";
  const secondInitial = parts[1]?.[0] ?? "A";
  return `${firstInitial}${secondInitial}`.toUpperCase();
};

const DataField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div className="space-y-1">
    <p className="text-muted-foreground text-sm">{label}</p>
    <p className="font-medium break-words">{value || "-"}</p>
  </div>
);

export const AdminAdmissionActions = ({
  admission,
  menuOnly = false,
}: {
  admission: AdmissionResponse;
  menuOnly?: boolean;
}) => {
  const isPending = admission.status === "PENDING";
  const { onDelete } = useAdmissionDelete();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (menuOnly) {
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
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="text-red-600 focus:text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Admission</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this admission? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(admission.id);
                  setIsDeleteOpen(false);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* View Details Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="px-8 pt-8">
            <DialogTitle className="text-left text-2xl">
              Admission Details
            </DialogTitle>
            <DialogDescription>
              Application ID: {admission.applicationId}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-8 pb-8">
            <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
              <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6 lg:w-72">
                <Avatar className="h-28 w-28 border">
                  <AvatarImage
                    src={admission.photo || undefined}
                    alt={admission.name || "Student photo"}
                  />
                  <AvatarFallback className="text-xl font-semibold">
                    {getInitials(admission.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="w-full space-y-3 text-center">
                  <p className="text-lg font-semibold">
                    {admission.name || "-"}
                  </p>
                  <p className="text-muted-foreground text-sm break-all">
                    {admission.email || "-"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {admission.phoneNumber || "-"}
                  </p>
                </div>

                <div className="w-full space-y-3 border-t pt-4">
                  <DataField
                    label="Admission Mode"
                    value={admission.modeOfAdmission}
                  />
                  <DataField
                    label="Application ID"
                    value={admission.applicationId}
                  />
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Status</p>
                    <Badge variant={getStatusVariant(admission.status)}>
                      {admission.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                {isPending ? (
                  <div className="bg-secondary/20 rounded-xl border p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      This applicant has not yet submitted their details.
                    </p>
                  </div>
                ) : (
                  <>
                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 text-lg font-semibold">
                        Personal Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <DataField label="Name" value={admission.name} />
                        <DataField label="Email" value={admission.email} />
                        <DataField
                          label="Phone"
                          value={admission.phoneNumber}
                        />
                        <DataField label="Gender" value={admission.gender} />
                        <div className="space-y-1 md:col-span-2">
                          <p className="text-muted-foreground text-sm">
                            Address
                          </p>
                          <p className="font-medium break-words">
                            {admission.address || "-"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 text-lg font-semibold">
                        Academic Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <DataField
                          label="10th Marks"
                          value={
                            typeof admission.class10thMarks === "number"
                              ? `${admission.class10thMarks}%`
                              : "-"
                          }
                        />
                        <DataField
                          label="10th School"
                          value={admission.class10thSchoolName}
                        />
                        <DataField
                          label="12th Marks"
                          value={
                            typeof admission.class12thMarks === "number"
                              ? `${admission.class12thMarks}%`
                              : "-"
                          }
                        />
                        <DataField
                          label="12th School"
                          value={admission.class12thSchoolName}
                        />
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 text-lg font-semibold">
                        Parent Information
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <DataField
                          label="Father's Name"
                          value={admission.fatherName}
                        />
                        <DataField
                          label="Mother's Name"
                          value={admission.motherName}
                        />
                        <DataField
                          label="Father's Phone"
                          value={admission.fatherNumber}
                        />
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 text-lg font-semibold">Documents</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Passport Photo
                          </p>
                          {admission.photo ? (
                            <a
                              href={admission.photo}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            10th Marks Card PDF
                          </p>
                          {admission.class10thMarksPdf ? (
                            <a
                              href={admission.class10thMarksPdf}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            12th Marks Card PDF
                          </p>
                          {admission.class12thMarksPdf ? (
                            <a
                              href={admission.class12thMarksPdf}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              View file
                            </a>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
