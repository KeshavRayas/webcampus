"use client";

import { Button } from "@webcampus/ui/components/button";
import {
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
import { DialogForm } from "@webcampus/ui/molecules/dialog-form";
import { Eye, EyeOff } from "lucide-react";
import React, { useEffect } from "react";
import { UserPhotoUpload } from "../shared/user-photo-upload";
import { useCreateDepartmentForm } from "./use-create-department-form";

export const CreateDepartmentView = () => {
  const { form, onSubmit, logoFile, setLogoFile } = useCreateDepartmentForm();
  const [showPassword, setShowPassword] = React.useState(false);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  return (
    <DialogForm
      trigger="Create Department"
      title="Create Department"
      form={form}
      onSubmit={onSubmit}
      contentClassName="sm:max-w-xl"
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-1 py-1">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} type="text" placeholder="Department Name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} type="text" placeholder="Username" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code *</FormLabel>
              <FormControl>
                <Input {...field} type="text" placeholder="e.g. CS" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="abbreviation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Abbreviation *</FormLabel>
              <FormControl>
                <Input {...field} type="text" placeholder="e.g. CSE" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="DEGREE_GRANTING">
                    Degree Granting
                  </SelectItem>
                  <SelectItem value="BASIC_SCIENCES">Basic Sciences</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input {...field} type="email" placeholder="Email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <FormItem>
          <FormLabel>Department Logo *</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setLogoFile(file);
                  }}
                />
                <Button type="button" variant="outline" asChild>
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Browse Logo...
                  </label>
                </Button>
                {logoFile && (
                  <span className="text-muted-foreground text-sm">
                    {logoFile.name}
                  </span>
                )}
              </div>
              {previewUrl && (
                <div className="border-border relative mt-2 h-24 w-24 overflow-hidden rounded-md border">
                  <img
                    src={previewUrl}
                    alt="Logo Preview"
                    className="h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="opactiy-100 absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm hover:opacity-90"
                    onClick={() => setLogoFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem> */}
        <UserPhotoUpload
          label="Department Logo *"
          personName={form.watch("name") || "Department"}
          previewUrl={previewUrl}
          selectedFileName={logoFile?.name || null}
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            setLogoFile(file);
          }}
        />
      </div>
    </DialogForm>
  );
};
