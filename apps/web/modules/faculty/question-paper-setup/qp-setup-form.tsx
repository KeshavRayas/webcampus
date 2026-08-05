"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  CreateAssessmentSchema,
  CreateAssessmentType,
} from "@webcampus/schemas/faculty";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@webcampus/ui/components/form";
import { Input } from "@webcampus/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import axios, { AxiosError } from "axios";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { SetupContext } from "./question-paper-dashboard";

interface QPSetupFormProps {
  setupContext: SetupContext;
  onSuccess: () => void;
}

const inferNumberOfParts = (
  questions: CreateAssessmentType["questions"]
): number => {
  let max = 1;
  for (const q of questions) {
    const match = q.part.match(/^Part (\d+)$/);
    if (match) {
      max = Math.max(max, parseInt(match[1]!, 10));
    }
  }
  return max;
};

export const QPSetupForm = ({ setupContext, onSuccess }: QPSetupFormProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const [isCopying, setIsCopying] = useState(false);
  const [computedTotal, setComputedTotal] = useState(0);

  const { course, assessmentTitle, maxMarks, componentType, sequence } =
    setupContext;

  const baseType = assessmentTitle.split(" ")[0] || "";

  const copyOptions = useMemo(() => {
    return (
      course.assessments?.filter(
        (a) => a.title.startsWith(baseType) && a.title !== assessmentTitle
      ) || []
    );
  }, [course.assessments, assessmentTitle, baseType]);

  const form = useForm<CreateAssessmentType>({
    resolver: zodResolver(CreateAssessmentSchema),
    defaultValues: {
      courseId: course.id,
      semesterId: course.semesterId,
      title: assessmentTitle,
      componentType,
      sequence,
      totalMarks: maxMarks,
      questions: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const questionsWatch = form.watch("questions");
  const isValidTotal = computedTotal === maxMarks;

  const nextFreeOrGroupNumber = (part: string): number => {
    const used = new Set<number>();
    getOrGroupOptions(part).forEach((name) => {
      const match = /^OR Group (\d+)$/.exec(name);
      const groupNumber = match?.[1];
      if (groupNumber) used.add(parseInt(groupNumber, 10));
    });
    let n = 1;
    while (used.has(n)) n += 1;
    return n;
  };

  const createOrGroupId = (part: string) =>
    `OR Group ${nextFreeOrGroupNumber(part)}`;

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
          const letter = String.fromCharCode(96 + nextCount);
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

  useEffect(() => {
    const computeAndSetTotal = () => {
      const questions = form.getValues("questions");
      setComputedTotal(computeTotalMarks(questions));
    };

    computeAndSetTotal();

    const subscription = form.watch((_value, { name }) => {
      if (name === "questions" || name?.startsWith("questions.")) {
        computeAndSetTotal();
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

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
      replace(renumbered);
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

  const handleRemove = (_part: string, index: number) => {
    const currentQuestions = form.getValues("questions");
    const remaining = currentQuestions.filter((_, i) => i !== index);
    const renumbered = recalculateGlobalNumbering(remaining, parts);
    replace(renumbered);
  };

  const handleOrGroupChange = (index: number, value: string) => {
    if (value === "__new__") {
      const part = form.getValues(`questions.${index}.part`);
      const newGroupId = createOrGroupId(part);
      form.setValue(`questions.${index}.orGroupId`, newGroupId, {
        shouldDirty: true,
      });
      return;
    }

    form.setValue(`questions.${index}.orGroupId`, value || undefined, {
      shouldDirty: true,
    });
  };

  const handleCopyFrom = async (assessmentId: string) => {
    if (
      !window.confirm(
        "This will overwrite your current questions. Are you sure?"
      )
    ) {
      return;
    }

    setIsCopying(true);
    try {
      const res = await axios.get(
        `${NEXT_PUBLIC_API_BASE_URL}/faculty/assessment/${assessmentId}`,
        { withCredentials: true }
      );

      const data = res.data.data;
      if (data && data.questions) {
        const clonedQuestions = data.questions.map(
          (q: Record<string, string | number>) => ({
            part: q.part,
            qNumber: q.qNumber,
            marks: q.marks,
            co: q.co || undefined,
            po: q.po || undefined,
            bl: q.bl || undefined,
            orGroupId: q.orGroupId || undefined,
          })
        );

        const partCount = inferNumberOfParts(clonedQuestions);
        const newParts = Array.from(
          { length: partCount },
          (_, i) => `Part ${i + 1}`
        );
        const renumbered = recalculateGlobalNumbering(
          clonedQuestions,
          newParts
        );

        setNumberOfParts(partCount);
        replace(renumbered);
        toast.success("Assessment template copied successfully!");
      }
    } catch (error) {
      console.error(error);
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
    if (!isValidTotal) {
      toast.error(
        `Calculated marks (${computedTotal}) must exactly match the configured maximum marks (${maxMarks}).`
      );
      return;
    }
    mutation.mutate(values);
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
        className="space-y-6"
      >
        {copyOptions.length > 0 && (
          <div className="bg-muted/30 flex items-center gap-4 rounded-lg border p-4">
            <Copy className="text-muted-foreground h-5 w-5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold">
                Copy from existing {baseType}?
              </h4>
              <p className="text-muted-foreground text-xs">
                Duplicate an existing paper setup.
              </p>
            </div>
            <Select onValueChange={handleCopyFrom} disabled={isCopying}>
              <SelectTrigger className="w-50">
                <SelectValue
                  placeholder={isCopying ? "Copying..." : "Select to copy"}
                />
              </SelectTrigger>
              <SelectContent>
                {copyOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
                  handlePartsChange(parseInt(e.target.value, 10) || 1)
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
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      title="Number of main questions"
                    />
                    <span className="text-muted-foreground">Q&apos;s</span>
                    <span className="text-muted-foreground mx-2">/</span>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      value={generators[part]?.subQCount ?? 1}
                      onChange={(e) =>
                        updateGenerator(
                          part,
                          "subQCount",
                          parseInt(e.target.value, 10) || 0
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
                                              parseInt(e.target.value, 10) || 0
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

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm font-medium">
            Total Calculated Marks:{" "}
            <span
              className={`ml-2 text-xl font-bold ${isValidTotal ? "text-green-600" : "text-destructive"}`}
            >
              {computedTotal} / {maxMarks}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onSuccess}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !isValidTotal}
            >
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
