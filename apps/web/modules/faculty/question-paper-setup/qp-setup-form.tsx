"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateAssessmentSchema,
  CreateAssessmentType,
} from "@webcampus/schemas/faculty";
import type { ErrorResponse, SuccessResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
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
    semesterId: string;
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
      semesterId: course.semesterId,
      title: "CIE 1",
      totalMarks: 0,
      questions: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const questionsWatch = form.watch("questions");

  const createOrGroupId = () =>
    `group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const buildPartQuestions = (
    part: string,
    qCount: number,
    subQCount: number
  ): CreateAssessmentType["questions"] => {
    const generated: CreateAssessmentType["questions"] = [];

    for (let i = 0; i < qCount; i++) {
      const mainNumber = i + 1;
      if (subQCount > 0) {
        for (let j = 0; j < subQCount; j++) {
          const letter = String.fromCharCode(97 + j);
          generated.push({
            part,
            qNumber: `${mainNumber}${letter}`,
            marks: 1,
            co: "",
            po: "",
            bl: "",
            orGroupId: undefined,
          });
        }
      } else {
        generated.push({
          part,
          qNumber: `${mainNumber}`,
          marks: 1,
          co: "",
          po: "",
          bl: "",
          orGroupId: undefined,
        });
      }
    }

    return generated;
  };

  const computeTotalMarks = (questions: CreateAssessmentType["questions"]) => {
    const partTotals = new Map<
      string,
      { standaloneSum: number; orGroupMaxes: Map<string, number> }
    >();

    questions.forEach((question) => {
      const marks = Number(question.marks) || 0;
      if (!partTotals.has(question.part)) {
        partTotals.set(question.part, {
          standaloneSum: 0,
          orGroupMaxes: new Map<string, number>(),
        });
      }

      const partTotalsEntry = partTotals.get(question.part)!;

      if (question.orGroupId) {
        const currentMax =
          partTotalsEntry.orGroupMaxes.get(question.orGroupId) || 0;
        partTotalsEntry.orGroupMaxes.set(
          question.orGroupId,
          Math.max(currentMax, marks)
        );
      } else {
        partTotalsEntry.standaloneSum += marks;
      }
    });

    let total = 0;
    partTotals.forEach(({ standaloneSum, orGroupMaxes }) => {
      const groupTotals = Array.from(orGroupMaxes.values());
      const sumOfMaxes = groupTotals.reduce((sum, max) => sum + max, 0);
      total += standaloneSum + sumOfMaxes;
    });

    return total;
  };

  const recalculateGlobalNumbering = (
    questions: CreateAssessmentType["questions"],
    partsList: string[]
  ) => {
    const updated = [...questions];
    let globalMainNumber = 1;

    partsList.forEach((part) => {
      const partIndices = questions
        .map((q, index) => (q.part === part ? index : -1))
        .filter((index) => index !== -1);

      if (partIndices.length === 0) return;

      const assignedGlobalNumbers = new Map<string, number>();
      const groupSizes = new Map<string, number>();

      partIndices.forEach((index) => {
        const question = questions[index]!;
        const match = question.qNumber.match(/^(\d+)/);
        const originalBase = match ? match[1] : question.qNumber;

        const logicKey = question.orGroupId
          ? `orgroup_${question.orGroupId}`
          : `base_${originalBase}`;

        if (!assignedGlobalNumbers.has(logicKey)) {
          assignedGlobalNumbers.set(logicKey, globalMainNumber++);
        }
        groupSizes.set(logicKey, (groupSizes.get(logicKey) || 0) + 1);
      });

      const subCounters = new Map<string, number>();

      partIndices.forEach((index) => {
        const question = questions[index]!;
        const match = question.qNumber.match(/^(\d+)/);
        const originalBase = match ? match[1] : question.qNumber;

        const logicKey = question.orGroupId
          ? `orgroup_${question.orGroupId}`
          : `base_${originalBase}`;

        const mainNum = assignedGlobalNumbers.get(logicKey)!;
        const totalInGroup = groupSizes.get(logicKey)!;

        if (totalInGroup > 1) {
          const nextCount = (subCounters.get(logicKey) || 0) + 1;
          subCounters.set(logicKey, nextCount);
          const letter = String.fromCharCode(96 + nextCount); // 1->a, 2->b...
          updated[index] = {
            ...question,
            qNumber: `${mainNum}${letter}`,
          };
        } else {
          updated[index] = {
            ...question,
            qNumber: `${mainNum}`,
          };
        }
      });
    });

    return updated;
  };

  const getOrGroupOptions = (part: string) => {
    const options = new Set<string>();
    questionsWatch.forEach((question) => {
      if (question.part === part && question.orGroupId) {
        options.add(question.orGroupId);
      }
    });
    return Array.from(options.values()).sort();
  };

  // Sum marks with OR logic and update total both locally and to parent
  useEffect(() => {
    const computeAndSetTotal = () => {
      const questions = form.getValues("questions");
      const total = computeTotalMarks(questions);

      if (form.getValues("totalMarks") !== total) {
        form.setValue("totalMarks", total);
        onMarksChange(total);
      }
    };

    computeAndSetTotal();

    const subscription = form.watch((_value, { name }) => {
      if (name === "questions" || name?.startsWith("questions.")) {
        computeAndSetTotal();
      }
    });

    return () => subscription.unsubscribe();
  }, [form, onMarksChange]);

  // Dynamic parts state
  const [numberOfParts, setNumberOfParts] = useState(1);
  const parts = Array.from(
    { length: numberOfParts },
    (_, i) => `Part ${i + 1}`
  );

  const handlePartsChange = (newCount: number) => {
    const count = Math.max(1, Math.min(10, newCount));
    const newParts = Array.from({ length: count }, (_, i) => `Part ${i + 1}`);
    const validParts = new Set(newParts);

    const currentQuestions = form.getValues("questions");
    const filteredQuestions = currentQuestions.filter((q) =>
      validParts.has(q.part)
    );

    if (filteredQuestions.length !== currentQuestions.length) {
      const renumbered = recalculateGlobalNumbering(
        filteredQuestions,
        newParts
      );
      form.setValue("questions", renumbered, { shouldDirty: true });
    } else {
      // Even if no questions were removed, adding a part doesn't require renumbering existing ones
      // because new parts are appended.
    }

    setNumberOfParts(count);
  };

  type GeneratorState = { qCount: number; subQCount: number };
  const [generators, setGenerators] = useState<Record<string, GeneratorState>>(
    {}
  );

  const updateGenerator = (
    part: string,
    field: keyof GeneratorState,
    value: number
  ) => {
    setGenerators((prev) => ({
      ...prev,
      [part]: {
        ...(prev[part] || { qCount: 1, subQCount: 1 }),
        [field]: value,
      },
    }));
  };

  const handleGenerate = (part: string) => {
    const { qCount, subQCount } = generators[part] || {
      qCount: 1,
      subQCount: 1,
    };
    if (qCount <= 0) return;

    const generatedPartQuestions = buildPartQuestions(part, qCount, subQCount);
    const currentQuestions = form.getValues("questions");
    const questionsByPart = new Map<
      string,
      CreateAssessmentType["questions"]
    >();

    parts.forEach((currentPart) => {
      const existing = currentQuestions.filter((q) => q.part === currentPart);
      questionsByPart.set(currentPart, existing);
    });

    questionsByPart.set(part, generatedPartQuestions);

    const nextQuestions = parts.flatMap(
      (currentPart) => questionsByPart.get(currentPart) || []
    );

    const renumbered = recalculateGlobalNumbering(nextQuestions, parts);
    replace(renumbered);
  };

  const handleRemove = (part: string, index: number) => {
    const currentQuestions = form.getValues("questions");
    const remaining = currentQuestions.filter((_, i) => i !== index);
    const renumbered = recalculateGlobalNumbering(remaining, parts);
    replace(renumbered);
  };

  const handleOrGroupChange = (index: number, value: string) => {
    if (value === "__new__") {
      const newGroupId = createOrGroupId();
      form.setValue(`questions.${index}.orGroupId`, newGroupId, {
        shouldDirty: true,
      });
      return;
    }

    form.setValue(`questions.${index}.orGroupId`, value || undefined, {
      shouldDirty: true,
    });
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
    const totalMarks = computeTotalMarks(data.questions);
    form.setValue("totalMarks", totalMarks);
    onMarksChange(totalMarks);
    mutation.mutate({
      ...data,
      totalMarks,
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form Validation Errors:", errors);
          toast.error(
            "Please fix validation errors before saving. Check if marks are set for all questions."
          );
        })}
        className="space-y-8"
      >
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

        <div className="flex items-center gap-4 border-b pb-6">
          <div className="flex flex-col gap-2">
            <FormLabel className="text-base">Number of Parts</FormLabel>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={10}
                className="w-24"
                value={numberOfParts}
                onChange={(e) =>
                  handlePartsChange(parseInt(e.target.value) || 1)
                }
              />
              <span className="text-muted-foreground text-sm">
                Determines how many part sections to generate below.
              </span>
            </div>
          </div>
        </div>

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
                      value={generators[part]?.qCount ?? 1}
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
                      min={1}
                      className="h-8 w-20"
                      value={generators[part]?.subQCount ?? 1}
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
                      Generate
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
                          <th className="w-40 px-4 py-3">OR</th>
                          <th className="w-16 px-4 py-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {partIndices.map((index) => {
                          const orGroupOptions = getOrGroupOptions(part);
                          return (
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
                                        <div className="flex items-center gap-2">
                                          <Input
                                            className="h-8 w-16"
                                            {...field}
                                          />
                                          {questionsWatch[index]?.orGroupId && (
                                            <Badge variant="secondary">
                                              OR Group:{" "}
                                              {questionsWatch[index]?.orGroupId}
                                            </Badge>
                                          )}
                                        </div>
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
                              <td className="px-4 py-2">
                                <FormField
                                  control={form.control}
                                  name={`questions.${index}.orGroupId`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <select
                                          className="bg-background h-8 w-full rounded-md border px-2 text-xs"
                                          value={field.value ?? ""}
                                          onChange={(event) =>
                                            handleOrGroupChange(
                                              index,
                                              event.target.value
                                            )
                                          }
                                        >
                                          <option value="">No OR Group</option>
                                          {orGroupOptions.map((option) => (
                                            <option key={option} value={option}>
                                              Link {option}
                                            </option>
                                          ))}
                                          <option value="__new__">
                                            Create new OR group
                                          </option>
                                        </select>
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
                                  onClick={() => handleRemove(part, index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
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
