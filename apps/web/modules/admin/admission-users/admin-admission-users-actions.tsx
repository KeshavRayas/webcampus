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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { MoreHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UserPhotoUpload } from "../shared/user-photo-upload";
import { AdminAdmissionUserResponse } from "./admin-admission-users-columns";
import {
  useAdmissionUserDelete,
  useAdmissionUserUpdate,
} from "./use-admission-users";

type UpdateAdmissionUserFormValues = z.infer<typeof UpdateAdmissionUserSchema>;

export const AdminAdmissionUsersActions = ({
  user,
}: {
  user: AdminAdmissionUserResponse;
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const { onDelete, isDeleting } = useAdmissionUserDelete();
  const { updateUser, isUpdating } = useAdmissionUserUpdate();

  const editForm = useForm<UpdateAdmissionUserFormValues>({
    resolver: zodResolver(UpdateAdmissionUserSchema),
    defaultValues: {
      name: user.name,
      username: user.username || "",
      email: user.email,
      role:
        user.role === "admission_admin"
          ? "admission_admin"
          : "admission_reviewer",
    },
  });

  const replacePhotoPreview = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!file) {
      setEditPhotoPreview(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setEditPhotoPreview(nextPreviewUrl);
  };

  const resetEditState = () => {
    editForm.reset({
      name: user.name,
      username: user.username || "",
      email: user.email,
      role:
        user.role === "admission_admin"
          ? "admission_admin"
          : "admission_reviewer",
    });
    setEditPhotoFile(null);
    replacePhotoPreview(null);
  };

  const handleEditPhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setEditPhotoFile(file);
    replacePhotoPreview(file);
  };

  const handleEditSubmit = async (data: UpdateAdmissionUserFormValues) => {
    try {
      await updateUser({
        id: user.id,
        data,
        photoFile: editPhotoFile,
      });
      setIsEditOpen(false);
      resetEditState();
    } catch {
      // Toast feedback is handled by the mutation hook.
    }
  };

  useEffect(() => {
    if (isEditOpen) {
      resetEditState();
    }
  }, [isEditOpen, user.email, user.name, user.role, user.username]);

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
            Edit User
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete User
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
            <DialogTitle>Edit Admission User</DialogTitle>
            <DialogDescription>
              Update login details and replace the current profile photo if
              needed.
            </DialogDescription>
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
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admission_admin">
                          Admission Admin (Data Entry)
                        </SelectItem>
                        <SelectItem value="admission_reviewer">
                          Admission Reviewer (Approvals)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <UserPhotoUpload
                label="Profile Photo"
                personName={editForm.watch("name") || user.name}
                previewUrl={editPhotoPreview}
                currentImageUrl={user.image}
                selectedFileName={editPhotoFile?.name || null}
                onChange={handleEditPhotoChange}
              />

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
            <DialogTitle>Delete Admission User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {user.name} ({user.role})? This
              action cannot be undone and will permanently remove their access.
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
