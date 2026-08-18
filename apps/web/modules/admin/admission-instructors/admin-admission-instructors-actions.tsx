"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateAdmissionUserSchema } from "@webcampus/schemas/admin";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { MoreHorizontal, Trash } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  useAdmissionUserDelete,
  useAdmissionUserUpdate,
} from "../admission-users/use-admission-users";
import { UserPhotoUpload } from "../shared/user-photo-upload";
import { AdminAdmissionInstructorResponse } from "./admin-admission-instructors-columns";

type UpdateAdmissionUserFormValues = z.infer<typeof UpdateAdmissionUserSchema>;

const editAdmissionInstructorSchema = UpdateAdmissionUserSchema.extend({
  password: z.string().optional().or(z.literal("")),
});

type EditAdmissionInstructorFormValues = z.infer<
  typeof editAdmissionInstructorSchema
>;

export const AdminAdmissionInstructorsActions = ({
  user,
}: {
  user: AdminAdmissionInstructorResponse;
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    user.photo ?? null
  );

  const previewUrlRef = useRef<string | null>(null);
  const { onDelete, isDeleting } = useAdmissionUserDelete();
  const { updateUser, isUpdating, photoFile, setPhotoFile } =
    useAdmissionUserUpdate();

  const editForm = useForm<EditAdmissionInstructorFormValues>({
    resolver: zodResolver(editAdmissionInstructorSchema),
    defaultValues: {
      name: user.name,
      username: user.username || "",
      email: user.email,
      password: "",
    },
  });

  const replacePhotoPreview = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setPhotoPreview(user.photo ?? null);
      return;
    }

    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;
    setPhotoPreview(preview);
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    replacePhotoPreview(file);
  };

  const resetEditState = () => {
    editForm.reset({
      name: user.name,
      username: user.username || "",
      email: user.email,
      password: "",
    });

    setPhotoFile(null);
    replacePhotoPreview(null);
  };

  const handleEditSubmit = async (data: EditAdmissionInstructorFormValues) => {
    if (!photoFile) {
      editForm.setError("root", {
        message: "Please upload a profile photo.",
      });
      return;
    }

    try {
      const payload = { ...data } as UpdateAdmissionUserFormValues;
      if (!payload.password) {
        delete payload.password;
      }
      await updateUser({
        id: user.id,
        data: payload,
        photoFile,
      });
      setIsEditOpen(false);
      resetEditState();
    } catch {}
  };

  useEffect(() => {
    if (isEditOpen) {
      resetEditState();
    }
  }, [isEditOpen, user]);
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

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
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
            Edit Instructor
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete Instructor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            resetEditState();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Admission Instructor</DialogTitle>
            <DialogDescription>Update login details.</DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., John Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., john.doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        {...field}
                        placeholder="john@example.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        placeholder="Leave blank to keep current password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <UserPhotoUpload
                label="Profile Photo*"
                personName={editForm.watch("name") || "Admission Instructor"}
                previewUrl={photoPreview}
                selectedFileName={photoFile?.name || null}
                onChange={handlePhotoChange}
              />

              {editForm.formState.errors.root && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.root.message}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditOpen(false);
                    resetEditState();
                  }}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Admission Instructor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {user.name}? This action cannot be
              undone and will permanently remove their access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onDelete(user.id);
                setIsDeleteOpen(false);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
