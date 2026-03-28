"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { DesignationEnum, StaffTypeEnum } from "@webcampus/schemas/faculty";
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
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";
import { MoreHorizontal } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminFacultyResponse } from "./admin-faculty-columns";
import {
  useCreateHodAccount,
  useDeleteFaculty,
  useReassignHodAccount,
  useUpdateFaculty,
} from "./use-faculty";

const editSchema = z.object({
  designation: DesignationEnum,
  username: z.string().min(1, "Username is required"),
  displayUsername: z.string().min(1, "Display username is required"),
  employeeId: z.string().optional(),
  staffType: StaffTypeEnum.optional(),
  dob: z.coerce.date().optional(),
  dateOfJoining: z.coerce.date().optional(),
});

const hodCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const AdminFacultyActions = ({
  faculty,
}: {
  faculty: AdminFacultyResponse;
}) => {
  const queryClient = useQueryClient();
  const departmentId = faculty.departmentId;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHodOpen, setIsHodOpen] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  // Grab existing faculty to find existing HODs
  const allFaculty =
    queryClient.getQueryData<AdminFacultyResponse[]>([
      "admin-faculty",
      departmentId,
    ]) || [];
  const existingHods = allFaculty.filter((f) => f.hod !== null);

  const { mutate: updateFaculty, isPending: isUpdating } =
    useUpdateFaculty(departmentId);
  const { mutate: deleteFaculty, isPending: isDeleting } =
    useDeleteFaculty(departmentId);
  const { mutate: createHodAccount, isPending: isCreatingHod } =
    useCreateHodAccount(departmentId);
  const { mutate: reassignHodAccount, isPending: isReassigningHod } =
    useReassignHodAccount(departmentId);

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      designation: faculty.designation as z.infer<typeof DesignationEnum>,
      username: faculty.user.username || "",
      displayUsername: faculty.user.displayUsername || faculty.user.name || "",
      employeeId: faculty.employeeId || "",
      staffType: (faculty.staffType as any) || "",
      dob: faculty.dob ? new Date(faculty.dob) : undefined,
      dateOfJoining: faculty.dateOfJoining ? new Date(faculty.dateOfJoining) : undefined,
    },
  });

  const hodCreateForm = useForm<z.infer<typeof hodCreateSchema>>({
    resolver: zodResolver(hodCreateSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const [selectedHodIdToReassign, setSelectedHodIdToReassign] =
    useState<string>("");

  const onEditSubmit = (data: z.infer<typeof editSchema>) => {
    updateFaculty(
      { id: faculty.id, data, imageFile: editImageFile },
      {
        onSuccess: () => {
          setEditImageFile(null);
          setIsEditOpen(false);
        },
      }
    );
  };

  const onDeleteConfirm = () => {
    deleteFaculty(faculty.id, { onSuccess: () => setIsDeleteOpen(false) });
  };

  const onHodCreateSubmit = (data: z.infer<typeof hodCreateSchema>) => {
    createHodAccount(
      { id: faculty.id, data },
      { onSuccess: () => setIsHodOpen(false) }
    );
  };

  const handleReassign = () => {
    if (!selectedHodIdToReassign) return;
    reassignHodAccount(
      { id: faculty.id, hodId: selectedHodIdToReassign },
      { onSuccess: () => setIsHodOpen(false) }
    );
  };

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
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
            Edit Faculty
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsHodOpen(true)}>
            Manage HOD Role
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
            onClick={() => setIsDeleteOpen(true)}
          >
            Delete Faculty
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Faculty</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4 py-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="faculty.username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="displayUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Display name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DesignationEnum.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option
                                .split("_")
                                .map(
                                  (w) => w.charAt(0) + w.slice(1).toLowerCase()
                                )
                                .join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="staffType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {StaffTypeEnum.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., EMP2357433" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? new Date(field.value).toISOString().slice(0, 10) : ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="dateOfJoining"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Joining</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? new Date(field.value).toISOString().slice(0, 10) : ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel>Update Faculty Image</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setEditImageFile(file);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <DialogFooter>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Faculty</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {faculty.user.name}? This action
              cannot be undone. All associated data (if cascading) will be
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HOD DIALOG */}
      <Dialog open={isHodOpen} onOpenChange={setIsHodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage HOD Role: {faculty.user.name}</DialogTitle>
            <DialogDescription>
              Assign or rotate HOD portal access to this faculty member.
            </DialogDescription>
          </DialogHeader>

          {faculty.hod ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 py-4 text-sm font-medium text-green-600">
              This faculty member currently holds an active HOD Role.
            </div>
          ) : (
            <Tabs
              defaultValue={existingHods.length > 0 ? "reassign" : "create"}
            >
              <TabsList className="mb-4 w-full">
                {existingHods.length > 0 && (
                  <TabsTrigger value="reassign" className="flex-1">
                    Re-assign Existing
                  </TabsTrigger>
                )}
                <TabsTrigger value="create" className="flex-1">
                  Create New Account
                </TabsTrigger>
              </TabsList>

              {existingHods.length > 0 && (
                <TabsContent value="reassign" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Existing HOD Role to Transfer</Label>
                    <Select onValueChange={setSelectedHodIdToReassign}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an existing HOD..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingHods.map((hodFac) => (
                          <SelectItem
                            key={hodFac.hod!.id}
                            value={hodFac.hod!.id}
                          >
                            Transfer from: {hodFac.user.name} (
                            {hodFac.designation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleReassign}
                    disabled={!selectedHodIdToReassign || isReassigningHod}
                  >
                    {isReassigningHod ? "Re-assigning..." : "Re-assign Role"}
                  </Button>
                </TabsContent>
              )}

              <TabsContent value="create">
                <Form {...hodCreateForm}>
                  <form
                    onSubmit={hodCreateForm.handleSubmit(onHodCreateSubmit)}
                    className="space-y-4"
                  >
                    <div className="mt-4 space-y-4">
                      <FormField
                        control={hodCreateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HOD Display Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hodCreateForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HOD Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hodCreateForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HOD Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isCreatingHod}>
                        {isCreatingHod ? "Creating..." : "Create HOD Account"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
