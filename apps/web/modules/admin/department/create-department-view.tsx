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
import { Eye, EyeOff, Upload } from "lucide-react";
import React from "react";
import { useCreateDepartmentForm } from "./use-create-department-form";

export const CreateDepartmentView = () => {
  const { form, onSubmit, logoFile, setLogoFile } = useCreateDepartmentForm();
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <DialogForm
      trigger="Create Department"
      title="Create Department"
      form={form}
      onSubmit={onSubmit}
    >
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
                <SelectItem value="DEGREE_GRANTING">Degree Granting</SelectItem>
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
      <FormItem>
        <FormLabel>Department Logo *</FormLabel>
        <FormControl>
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
        </FormControl>
        <FormMessage />
      </FormItem>
    </DialogForm>
  );
};
