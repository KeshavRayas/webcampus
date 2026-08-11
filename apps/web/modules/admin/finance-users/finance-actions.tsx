"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { UserPhotoUpload } from "../shared/user-photo-upload";
import { FinanceUser } from "./finance-types";
import { useFinanceUserDelete, useFinanceUserEdit } from "./use-finance-users";

const editFinanceUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
});

type UpdateFinanceUserFormValues = z.infer<typeof editFinanceUserSchema>;

export const FinanceActions = ({ user }: { user: FinanceUser }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const { onDelete, isDeleting } = useFinanceUserDelete();
  const { onEdit, isEditing } = useFinanceUserEdit();

  const editForm = useForm<UpdateFinanceUserFormValues>({
    resolver: zodResolver(editFinanceUserSchema),
    defaultValues: {
      name: user.name,
      username: user.username || "",
      email: user.email,
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

  const handleEditSubmit = async (data: UpdateFinanceUserFormValues) => {
    try {
      const formData = new FormData();
      Object.entries({ ...data, role: "finance" }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      if (editPhotoFile instanceof File) {
        formData.append("photo", editPhotoFile);
      }
      await onEdit({ id: user.id, formData });
      setIsEditOpen(false);
      resetEditState();
    } catch {}
  };

  useEffect(() => {
    if (isEditOpen) {
      resetEditState();
    }
  }, [isEditOpen, user.email, user.name, user.username]);

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
            <DialogTitle>Edit Finance User</DialogTitle>
            <DialogDescription>
              Update user details and optionally replace the profile photo.
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
                      <Input {...field} placeholder="e.g., Jane Doe" />
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
                      <Input {...field} placeholder="e.g., finance.manager" />
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
                        placeholder="finance@webcampus.edu"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-muted-foreground text-sm">Finance</p>
                </div>

                <UserPhotoUpload
                  label="Profile Photo"
                  personName={editForm.watch("name") || user.name}
                  previewUrl={editPhotoPreview}
                  currentImageUrl={user.image}
                  selectedFileName={editPhotoFile?.name || null}
                  onChange={handleEditPhotoChange}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditOpen(false);
                    resetEditState();
                  }}
                  disabled={isEditing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing}>
                  {isEditing ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Finance User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {user.name} ({user.email})? This
              action cannot be undone.
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
