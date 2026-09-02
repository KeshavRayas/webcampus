"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  UpdateCourseOutcomesSchema,
  UpdateCourseOutcomesType,
} from "@webcampus/schemas/faculty";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import axios, { AxiosError } from "axios";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { CoordinatedCourse } from "./question-paper-dashboard";

interface ConfigureCODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CoordinatedCourse;
}

export const ConfigureCODialog = ({
  open,
  onOpenChange,
  course,
}: ConfigureCODialogProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["course-outcomes", course.id],
    queryFn: async () => {
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/course-outcomes?courseId=${course.id}`,
        { withCredentials: true }
      );
      return res.data.data;
    },
    enabled: open,
  });

  const form = useForm<UpdateCourseOutcomesType>({
    resolver: zodResolver(UpdateCourseOutcomesSchema) as never,
    defaultValues: {
      courseId: course.id,
      outcomes: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "outcomes",
  });

  useEffect(() => {
    if (data) {
      replace(data);
    }
  }, [data, replace]);

  const mutation = useMutation({
    mutationFn: async (values: UpdateCourseOutcomesType) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/course-outcomes`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success("Course outcomes updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["course-outcomes", course.id],
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message?: string }>;
      toast.error(
        err.response?.data?.message || "Failed to save course outcomes"
      );
    },
  });

  const onSubmit = (values: UpdateCourseOutcomesType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle>Configure Course Outcomes</DialogTitle>
          <DialogDescription>
            Manage Course Outcomes for {course.name} ({course.code})
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-4 text-center">Loading...</div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit as never)}
              className="space-y-4"
            >
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-4">
                    <FormField
                      control={form.control as never}
                      name={`outcomes.${index}.code`}
                      render={({ field }) => (
                        <FormItem className="w-1/4">
                          <FormControl>
                            <Input
                              placeholder="CO Code (e.g. CO1)"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control as never}
                      name={`outcomes.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Description" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  append({ code: "", description: "", isActive: true })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add Outcome
              </Button>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Save Outcomes"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
