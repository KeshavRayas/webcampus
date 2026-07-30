"use client";
import { AxiosError } from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateAssessmentSchema,
  CreateAssessmentType,
} from "@webcampus/schemas/faculty";
import { Button } from "@webcampus/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@webcampus/ui/components/select";
import axios from "axios";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { SetupContext } from "./question-paper-dashboard";

interface QPSetupFormProps {
  setupContext: SetupContext;
  onSuccess: () => void;
}

export const QPSetupForm = ({
  setupContext,
  onSuccess,
}: QPSetupFormProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const [isCopying, setIsCopying] = useState(false);

  const { course, assessmentTitle, maxMarks } = setupContext;

  // Extract base type (e.g., "CIE" from "CIE 2") to find compatible assessments
  const baseType = assessmentTitle.split(" ")[0] || "";

  const copyOptions = useMemo(() => {
    return course.assessments?.filter(
      (a) => a.title.startsWith(baseType) && a.title !== assessmentTitle
    ) || [];
  }, [course.assessments, assessmentTitle, baseType]);

  const form = useForm<CreateAssessmentType>({
    resolver: zodResolver(CreateAssessmentSchema),
    defaultValues: {
      courseId: course.id,
      semesterId: course.semesterId,
      title: assessmentTitle,
      totalMarks: maxMarks, // Force default to configured max marks
      questions: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const currentQuestions = form.watch("questions");
  const currentTotal = currentQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const isValidTotal = currentTotal === maxMarks;

  const handleCopyFrom = async (assessmentId: string) => {
    if (!window.confirm("This will overwrite your current questions. Are you sure?")) return;
    
    setIsCopying(true);
    try {
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/${assessmentId}`,
        { withCredentials: true }
      );
      
      const data = res.data.data;
      if (data && data.questions) {
        // Deep clone questions without IDs
        const clonedQuestions = data.questions.map((q: Record<string, string | number>) => ({
          part: q.part,
          qNumber: q.qNumber,
          marks: q.marks,
          co: q.co || undefined,
          po: q.po || undefined,
          bl: q.bl || undefined,
          orGroupId: q.orGroupId || undefined,
        }));
        replace(clonedQuestions);
        toast.success("Assessment template copied successfully!");
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to fetch assessment for copying.");
    } finally {
      setIsCopying(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: CreateAssessmentType) => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment`,
        values,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success(`${assessmentTitle} configured successfully`);
      queryClient.invalidateQueries({ queryKey: ["coordinated-courses"] });
      onSuccess();
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message?: string }>;
      toast.error(err.response?.data?.message || "Failed to save assessment");
    },
  });

  const onSubmit = (values: CreateAssessmentType) => {
    // Final verification barrier
    if (!isValidTotal) {
      toast.error(`Calculated marks (${currentTotal}) must exactly match the configured maximum marks (${maxMarks}).`);
      return;
    }
    mutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Copy Feature Header */}
        {copyOptions.length > 0 && (
          <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border">
            <Copy className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Copy from existing {baseType}?</h4>
              <p className="text-xs text-muted-foreground">Duplicate an existing paper setup.</p>
            </div>
            <Select onValueChange={handleCopyFrom} disabled={isCopying}>
              <SelectTrigger className="w-50">
                <SelectValue placeholder={isCopying ? "Copying..." : "Select to copy"} />
              </SelectTrigger>
              <SelectContent>
                {copyOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Questions Table UI */}
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left font-medium text-muted-foreground">
                <th className="p-3">Part</th>
                <th className="p-3">Q. No</th>
                <th className="p-3">Marks</th>
                <th className="p-3">CO (Optional)</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b">
                  <td className="p-2">
                    <FormField control={form.control} name={`questions.${index}.part`} render={({ field }) => (
                      <FormItem><FormControl><Input {...field} placeholder="e.g., A" className="w-20 uppercase" /></FormControl></FormItem>
                    )} />
                  </td>
                  <td className="p-2">
                    <FormField control={form.control} name={`questions.${index}.qNumber`} render={({ field }) => (
                      <FormItem><FormControl><Input {...field} placeholder="1a" className="w-24" /></FormControl></FormItem>
                    )} />
                  </td>
                  <td className="p-2">
                    <FormField control={form.control} name={`questions.${index}.marks`} render={({ field }) => (
                      <FormItem><FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value) || 0)} className="w-24" />
                      </FormControl></FormItem>
                    )} />
                  </td>
                  <td className="p-2">
                    <FormField control={form.control} name={`questions.${index}.co`} render={({ field }) => (
                      <FormItem><FormControl><Input {...field} placeholder="CO1" className="w-24 uppercase" /></FormControl></FormItem>
                    )} />
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 bg-muted/20">
            <Button type="button" variant="outline" size="sm" onClick={() => append({ part: "A", qNumber: "", marks: 0, co: "" })}>
              <Plus className="mr-2 h-4 w-4" /> Add Question
            </Button>
          </div>
        </div>

        {/* Footer & Validation */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm font-medium">
            Total Calculated Marks:{" "}
            <span className={`ml-2 text-xl font-bold ${isValidTotal ? "text-green-600" : "text-destructive"}`}>
              {currentTotal} / {maxMarks}
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onSuccess} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !isValidTotal}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Assessment
            </Button>
          </div>
        </div>

      </form>
    </Form>
  );
};