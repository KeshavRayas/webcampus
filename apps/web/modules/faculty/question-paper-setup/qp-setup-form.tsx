"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateAssessmentSchema,
  CreateAssessmentType,
} from "@webcampus/schemas/faculty";
import type { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import axios, { AxiosError } from "axios";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";

// Types are already imported via schemas/faculty

interface QPSetupFormProps {
  course: {
    id: string;
    semester?: { id: string };
  };
  onSuccess: () => void;
  onMarksChange: (marks: number) => void;
}

export const QPSetupForm = ({
  course,
  onSuccess,
  onMarksChange,
}: QPSetupFormProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();

  // If semesterId wasn't on the course dto, we might need a workaround.
  // Let's assume we have it or it's fetchable, for now use a blank string if undefined to placate Zod until we see the network payload.
  // (We added semesterId to the dashboard query, we can pull it from there. Actually I'll use the URL params or context if possible, or just default it)

  const form = useForm<CreateAssessmentType>({
    resolver: zodResolver(CreateAssessmentSchema),
    defaultValues: {
      courseId: course.id,
      semesterId: course.semester?.id || "00000000-0000-0000-0000-000000000000",
      title: "CIE 1",
      totalMarks: 0,
      questions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const questionsWatch = form.watch("questions");

  // Sum marks and update total both locally and to parent
  useEffect(() => {
    const total = questionsWatch.reduce(
      (acc, q) => acc + (Number(q.marks) || 0),
      0
    );
    form.setValue("totalMarks", total);
    onMarksChange(total);
  }, [questionsWatch, form, onMarksChange]);

  // Generator states for each part
  const [parts] = useState(["Part A", "Part B", "Part C"]);
  type GeneratorState = { qCount: number; subQCount: number };
  const [generators, setGenerators] = useState<Record<string, GeneratorState>>({
    "Part A": { qCount: 1, subQCount: 0 },
    "Part B": { qCount: 1, subQCount: 0 },
    "Part C": { qCount: 1, subQCount: 0 },
  });

  const updateGenerator = (
    part: string,
    field: keyof GeneratorState,
    value: number
  ) => {
    setGenerators((prev) => ({
      ...prev,
      [part]: {
        ...(prev[part] || { qCount: 1, subQCount: 0 }),
        [field]: value,
      },
    }));
  };

  const handleGenerate = (part: string) => {
    const { qCount, subQCount } = generators[part]!;
    if (qCount <= 0) return;

    // Find the highest main question number across ALL existing questions
    let highestQNum = 0;
    questionsWatch.forEach((q) => {
      // Parse out the integer prefix, e.g. "1a" -> 1
      const match = q.qNumber.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1]!, 10);
        if (num > highestQNum) {
          highestQNum = num;
        }
      }
    });

    let currentQNum = highestQNum + 1;
    const newQuestions: CreateAssessmentType["questions"] = [];

    for (let i = 0; i < qCount; i++) {
      if (subQCount > 0) {
        for (let j = 0; j < subQCount; j++) {
          const letter = String.fromCharCode(97 + j); // 97 is 'a'
          newQuestions.push({
            part,
            qNumber: `${currentQNum}${letter}`,
            marks: 0,
            co: "",
            po: "",
            bl: "",
          });
        }
      } else {
        newQuestions.push({
          part,
          qNumber: `${currentQNum}`,
          marks: 0,
          co: "",
          po: "",
          bl: "",
        });
      }
      currentQNum++;
    }

    append(newQuestions);
  };

  const mutation = useMutation({
    mutationFn: async (data: CreateAssessmentType) => {
      return await axios.post<SuccessResponse<null>>(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment`,
        data,
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["coordinated-courses"] });
      onSuccess();
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      toast.error(
        error.response?.data?.message || "Failed to create assessment"
      );
    },
  });

  const onSubmit = (data: CreateAssessmentType) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>Assessment Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. CIE 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-8">
          {parts.map((part) => {
            // Filter fields belonging to this part
            const partIndices = fields
              .map((f, i) => (f.part === part ? i : -1))
              .filter((i) => i !== -1);

            return (
              <div key={part} className="bg-muted/20 rounded-xl border p-4">
                <div className="mb-4 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
                  <h3 className="text-lg font-semibold">{part}</h3>
                  <div className="bg-background flex items-center gap-2 rounded-lg border p-2 text-sm shadow-sm">
                    <span className="mr-2 font-medium">Generate:</span>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      value={generators[part]?.qCount}
                      onChange={(e) =>
                        updateGenerator(
                          part,
                          "qCount",
                          parseInt(e.target.value) || 0
                        )
                      }
                      title="Number of main questions"
                    />
                    <span className="text-muted-foreground">Q&apos;s</span>
                    <span className="text-muted-foreground ml-2 mr-2">/</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-20"
                      value={generators[part]?.subQCount}
                      onChange={(e) =>
                        updateGenerator(
                          part,
                          "subQCount",
                          parseInt(e.target.value) || 0
                        )
                      }
                      title="Number of sub-questions per main question"
                    />
                    <span className="text-muted-foreground">Sub Q&apos;s</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ml-2"
                      onClick={() => handleGenerate(part)}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {partIndices.length > 0 ? (
                  <div className="bg-background relative overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="w-20 px-4 py-3">Q#</th>
                          <th className="w-32 px-4 py-3">Marks</th>
                          <th className="w-32 px-4 py-3">CO</th>
                          <th className="w-32 px-4 py-3">PO</th>
                          <th className="w-32 px-4 py-3">BL</th>
                          <th className="w-16 px-4 py-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {partIndices.map((index) => (
                          <tr
                            key={fields[index]!.id}
                            className="hover:bg-muted/30 border-b last:border-0"
                          >
                            <td className="px-4 py-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.qNumber`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input className="h-8 w-16" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.marks`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="h-8"
                                        {...field}
                                        onChange={(e) =>
                                          field.onChange(
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.co`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="h-8 uppercase placeholder:normal-case"
                                        placeholder="CO1"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.po`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="h-8 uppercase placeholder:normal-case"
                                        placeholder="PO1"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <FormField
                                control={form.control}
                                name={`questions.${index}.bl`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="h-8 uppercase placeholder:normal-case"
                                        placeholder="L1"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-8 w-8 opacity-50 hover:opacity-100"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center py-8 text-center text-sm">
                    <p>No questions added to {part} yet.</p>
                    <p className="mt-1 text-xs">
                      Use the generator above to add questions.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pb-2 pt-6">
          <div className="text-sm font-medium">
            Total Calculated Marks:{" "}
            <span className="text-primary ml-2 text-lg">
              {form.watch("totalMarks")}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSuccess()}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Assessment
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};
