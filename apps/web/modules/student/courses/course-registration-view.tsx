"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  useAvailableCurriculum,
  useRegistrationDashboard,
  useSubmitCourseRegistration,
} from "@/modules/student/courses/use-course-registration";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseTypeLabel } from "@webcampus/schemas/constants";
import { Alert, AlertDescription } from "@webcampus/ui/components/alert";
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
import {
  RadioGroup,
  RadioGroupItem,
} from "@webcampus/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const registrationFormSchema = z.object({
  professionalElectiveId: z.string().uuid().optional(),
  openElectiveId: z.string().uuid().optional(),
  openElectiveBatchId: z.string().uuid().optional(),
});

export const CourseRegistrationView = () => {
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
  } = useRegistrationDashboard();
  const { data: curriculum, isLoading: isCurriculumLoading } =
    useAvailableCurriculum();
  const submitRegistrationMutation = useSubmitCourseRegistration();

  const form = useForm<z.infer<typeof registrationFormSchema>>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      professionalElectiveId: undefined,
      openElectiveId: undefined,
    },
  });

  const selectedProfessionalElective = form.watch("professionalElectiveId");
  const selectedOpenElective = form.watch("openElectiveId");
  const selectedOpenElectiveBatch = form.watch("openElectiveBatchId");

  const [oeSearch, setOeSearch] = useState("");
  const [oeSeatsFilter, setOeSeatsFilter] = useState<
    "all" | "available" | "hide-full"
  >("all");

  const coreCourseIds = useMemo(
    () => curriculum?.coreCourses.map((course) => course.id) ?? [],
    [curriculum?.coreCourses]
  );

  const filteredOpenElectives = useMemo(() => {
    if (!curriculum) return [];
    const q = oeSearch.trim().toLowerCase();
    return curriculum.openElectives.filter((course) => {
      const matchesSearch =
        !q ||
        course.code.toLowerCase().includes(q) ||
        course.name.toLowerCase().includes(q) ||
        String(course.totalCredits).includes(q);
      if (!matchesSearch) return false;
      if (oeSeatsFilter === "available") {
        return (course.batches ?? []).some((b) => !b.isFull);
      }
      if (oeSeatsFilter === "hide-full") {
        const batches = course.batches ?? [];
        if (batches.length === 0) return true;
        return batches.some((b) => !b.isFull);
      }
      return true;
    });
  }, [curriculum, oeSearch, oeSeatsFilter]);

  const selectedOpenElectiveCourse = useMemo(
    () => curriculum?.openElectives.find((c) => c.id === selectedOpenElective),
    [curriculum?.openElectives, selectedOpenElective]
  );

  const canSubmit = useMemo(() => {
    if (!dashboard?.current.isWindowOpen || dashboard.current.hasRegistered) {
      return false;
    }

    if (!curriculum) {
      return false;
    }

    const hasPeSelection =
      curriculum.professionalElectives.length === 0 ||
      Boolean(selectedProfessionalElective);
    const hasOeSelection =
      curriculum.openElectives.length === 0 ||
      Boolean(selectedOpenElective && selectedOpenElectiveBatch);

    return hasPeSelection && hasOeSelection;
  }, [
    curriculum,
    dashboard?.current.hasRegistered,
    dashboard?.current.isWindowOpen,
    selectedOpenElective,
    selectedOpenElectiveBatch,
    selectedProfessionalElective,
  ]);

  const onSubmit = (values: z.infer<typeof registrationFormSchema>) => {
    if (!curriculum) {
      return;
    }

    const selectedCourseIds = [
      ...coreCourseIds,
      ...(values.professionalElectiveId ? [values.professionalElectiveId] : []),
      ...(values.openElectiveId ? [values.openElectiveId] : []),
    ];

    submitRegistrationMutation.mutate({
      courseIds: selectedCourseIds,
      ...(values.openElectiveId && values.openElectiveBatchId
        ? {
            oeBatchIds: { [values.openElectiveId]: values.openElectiveBatchId },
          }
        : {}),
    });
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">
          Loading course registration...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {getApiErrorMessage(error, "Unable to load course registration")}
        </p>
      </div>
    );
  }

  const history = dashboard?.history ?? [];
  const current = dashboard?.current;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Course Registration</h2>
        <p className="text-muted-foreground text-sm">
          Complete your semester registration by selecting required electives.
        </p>
      </header>

      <div className="space-y-3">
        {history.map((item) => (
          <Alert
            key={`${item.academicTermId}_${item.semesterId}`}
            className="border-green-500 bg-green-100 text-green-800"
          >
            <AlertDescription>
              Course registration for {item.academicTermLabel} -{" "}
              {item.semesterLabel} completed successfully.
            </AlertDescription>
          </Alert>
        ))}

        {current && !current.hasRegistered && !current.isWindowOpen && (
          <Alert className="border-red-500 bg-red-100 text-red-800">
            <AlertDescription>
              Course registration closed, please contact your proctor for
              instructions.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {current && current.isWindowOpen && !current.hasRegistered && (
        <div className="bg-card space-y-6 rounded-xl border p-4">
          {isCurriculumLoading || !curriculum ? (
            <p className="text-muted-foreground text-sm">
              Loading available curriculum...
            </p>
          ) : (
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    Mandatory Core Courses
                  </h3>
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">L-T-P-S</th>
                          <th className="px-3 py-2">Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {curriculum.coreCourses.map((course) => (
                          <tr key={course.id} className="border-t">
                            <td className="px-3 py-2">{course.code}</td>
                            <td className="px-3 py-2">{course.name}</td>
                            <td className="px-3 py-2">
                              {courseTypeLabel(course.courseType)}
                            </td>
                            <td className="px-3 py-2">{course.ltp}</td>
                            <td className="px-3 py-2">{course.totalCredits}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {curriculum.professionalElectives.length > 0 && (
                  <FormField
                    control={form.control}
                    name="professionalElectiveId"
                    rules={{ required: "Select one Professional Elective" }}
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base font-semibold">
                          Department Elective (PE)
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            name="professional-elective"
                            value={field.value}
                            onValueChange={field.onChange}
                            className="space-y-2"
                          >
                            {curriculum.professionalElectives.map((course) => {
                              const isFull = Boolean(course.isFull);
                              const seatsLabel =
                                course.capacity != null
                                  ? `${course.registeredCount ?? 0} / ${course.capacity} · ${course.seatsLeft ?? 0} seats left`
                                  : null;
                              return (
                                <label
                                  key={course.id}
                                  htmlFor={`pe-${course.id}`}
                                  className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                                    isFull
                                      ? "cursor-not-allowed opacity-60"
                                      : "cursor-pointer"
                                  }`}
                                >
                                  <RadioGroupItem
                                    id={`pe-${course.id}`}
                                    value={course.id}
                                    disabled={isFull}
                                  />
                                  <span className="text-sm">
                                    {course.code} - {course.name} (
                                    {course.totalCredits} credits)
                                    {seatsLabel ? (
                                      <span className="text-muted-foreground ml-2">
                                        {isFull ? "Full" : seatsLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {curriculum.openElectives.length > 0 && (
                  <FormField
                    control={form.control}
                    name="openElectiveId"
                    rules={{ required: "Select one Open Elective" }}
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <FormLabel className="text-base font-semibold">
                            Open Elective (OE)
                          </FormLabel>
                          <span className="text-muted-foreground text-xs">
                            {filteredOpenElectives.length} of{" "}
                            {curriculum.openElectives.length} shown
                            {selectedOpenElectiveCourse
                              ? ` · ${selectedOpenElectiveCourse.code} selected`
                              : ""}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <div className="relative flex-1">
                            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                            <Input
                              placeholder="Search by code, name or credits…"
                              value={oeSearch}
                              onChange={(e) => setOeSearch(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          <Select
                            value={oeSeatsFilter}
                            onValueChange={(v) =>
                              setOeSeatsFilter(
                                v as "all" | "available" | "hide-full"
                              )
                            }
                          >
                            <SelectTrigger className="w-full sm:w-[180px]">
                              <SelectValue placeholder="Filter" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All courses</SelectItem>
                              <SelectItem value="available">
                                Only with seats
                              </SelectItem>
                              <SelectItem value="hide-full">
                                Hide full courses
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <FormControl>
                          <RadioGroup
                            name="open-elective"
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("openElectiveBatchId", undefined);
                            }}
                            className="space-y-2"
                          >
                            {filteredOpenElectives.length === 0 ? (
                              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                                No courses match &quot;{oeSearch}&quot;.
                              </p>
                            ) : (
                              filteredOpenElectives.map((course) => {
                                const isSelected = field.value === course.id;
                                const batches = course.batches ?? [];
                                const hasAvailable = batches.some(
                                  (b) => !b.isFull
                                );
                                const minSeats = hasAvailable
                                  ? Math.max(
                                      ...batches
                                        .filter((b) => !b.isFull)
                                        .map((b) => b.seatsLeft ?? 0)
                                    )
                                  : 0;
                                return (
                                  <div
                                    key={course.id}
                                    className={`rounded-lg border transition-colors ${
                                      isSelected
                                        ? "border-primary bg-primary/5"
                                        : "bg-card"
                                    }`}
                                  >
                                    <label
                                      htmlFor={`oe-${course.id}`}
                                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                                    >
                                      <RadioGroupItem
                                        id={`oe-${course.id}`}
                                        value={course.id}
                                        aria-expanded={isSelected}
                                      />
                                      <span className="min-w-0 flex-1 text-sm">
                                        <span className="font-medium">
                                          {course.code}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {" "}
                                          — {course.name} ({course.totalCredits}{" "}
                                          credits)
                                        </span>
                                      </span>
                                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                                        {batches.length > 0 && (
                                          <Badge
                                            variant={
                                              !hasAvailable
                                                ? "destructive"
                                                : minSeats <= 1
                                                  ? "secondary"
                                                  : "outline"
                                            }
                                            className={
                                              hasAvailable && minSeats > 1
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                : hasAvailable && minSeats <= 1
                                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                                  : ""
                                            }
                                          >
                                            {!hasAvailable
                                              ? "Full"
                                              : `${minSeats} seats left`}
                                          </Badge>
                                        )}
                                        <span className="text-muted-foreground text-xs">
                                          {isSelected ? "▾" : "▸"}
                                        </span>
                                      </span>
                                    </label>

                                    {isSelected && batches.length > 0 && (
                                      <div className="sm:border-primary/30 border-t px-3 py-3 sm:ml-7 sm:border-l-2 sm:pl-4">
                                        <FormField
                                          control={form.control}
                                          name="openElectiveBatchId"
                                          rules={{
                                            required:
                                              "Select a batch for the Open Elective",
                                          }}
                                          render={({ field: batchField }) => (
                                            <FormItem className="space-y-2">
                                              <FormLabel className="text-primary text-xs font-semibold tracking-wide">
                                                Select Batch · {batches.length}{" "}
                                                {batches.length === 1
                                                  ? "option"
                                                  : "options"}{" "}
                                                — Faculty & seats
                                              </FormLabel>
                                              <FormControl>
                                                <RadioGroup
                                                  name="open-elective-batch"
                                                  value={batchField.value}
                                                  onValueChange={
                                                    batchField.onChange
                                                  }
                                                  className="space-y-2"
                                                >
                                                  {batches.map((batch) => (
                                                    <label
                                                      key={batch.batchId}
                                                      htmlFor={`oe-batch-${batch.batchId}`}
                                                      className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                                                        batch.isFull
                                                          ? "cursor-not-allowed opacity-60"
                                                          : "hover:border-primary/40 cursor-pointer"
                                                      } ${batchField.value === batch.batchId ? "border-primary bg-primary/5" : "bg-card"}`}
                                                    >
                                                      <RadioGroupItem
                                                        id={`oe-batch-${batch.batchId}`}
                                                        value={batch.batchId}
                                                        disabled={batch.isFull}
                                                      />
                                                      <span className="min-w-0 flex-1 text-sm">
                                                        Batch {batch.name}
                                                        {batch.facultyName ? (
                                                          <span className="text-muted-foreground ml-2">
                                                            ·{" "}
                                                            {batch.facultyName}
                                                          </span>
                                                        ) : null}
                                                      </span>
                                                      <Badge
                                                        variant={
                                                          batch.isFull
                                                            ? "destructive"
                                                            : (batch.seatsLeft ??
                                                                  0) <= 1
                                                              ? "secondary"
                                                              : "outline"
                                                        }
                                                        className={
                                                          !batch.isFull &&
                                                          (batch.seatsLeft ??
                                                            0) > 1
                                                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                            : !batch.isFull
                                                              ? "border-amber-300 bg-amber-50 text-amber-700"
                                                              : ""
                                                        }
                                                      >
                                                        {batch.isFull
                                                          ? "Full"
                                                          : `${batch.registeredCount} / ${batch.capacity} · ${batch.seatsLeft} seats left`}
                                                      </Badge>
                                                    </label>
                                                  ))}
                                                </RadioGroup>
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </RadioGroup>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || submitRegistrationMutation.isPending
                    }
                  >
                    {submitRegistrationMutation.isPending
                      ? "Submitting..."
                      : "Register"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      )}
    </section>
  );
};
