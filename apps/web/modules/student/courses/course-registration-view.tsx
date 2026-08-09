"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  useAvailableCurriculum,
  useRegistrationDashboard,
  useSubmitCourseRegistration,
} from "@/modules/student/courses/use-course-registration";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@webcampus/ui/components/alert";
import { Button } from "@webcampus/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@webcampus/ui/components/form";
import {
  RadioGroup,
  RadioGroupItem,
} from "@webcampus/ui/components/radio-group";
import { useMemo } from "react";
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

  const coreCourseIds = useMemo(
    () => curriculum?.coreCourses.map((course) => course.id) ?? [],
    [curriculum?.coreCourses]
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
                            <td className="px-3 py-2">{course.courseType}</td>
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
                    render={({ field }) => {
                      const selectedCourse = curriculum.openElectives.find(
                        (course) => course.id === field.value
                      );
                      const batches = selectedCourse?.batches ?? [];
                      return (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-base font-semibold">
                            Open Elective (OE)
                          </FormLabel>
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
                              {curriculum.openElectives.map((course) => (
                                <label
                                  key={course.id}
                                  htmlFor={`oe-${course.id}`}
                                  className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
                                >
                                  <RadioGroupItem
                                    id={`oe-${course.id}`}
                                    value={course.id}
                                  />
                                  <span className="text-sm">
                                    {course.code} - {course.name} (
                                    {course.totalCredits} credits)
                                  </span>
                                </label>
                              ))}
                            </RadioGroup>
                          </FormControl>

                          {batches.length > 0 && (
                            <FormField
                              control={form.control}
                              name="openElectiveBatchId"
                              rules={{
                                required:
                                  "Select a batch for the Open Elective",
                              }}
                              render={({ field: batchField }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-sm font-medium">
                                    Select Batch
                                  </FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      name="open-elective-batch"
                                      value={batchField.value}
                                      onValueChange={batchField.onChange}
                                      className="space-y-2"
                                    >
                                      {batches.map((batch) => (
                                        <label
                                          key={batch.batchId}
                                          htmlFor={`oe-batch-${batch.batchId}`}
                                          className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 ${
                                            batch.isFull
                                              ? "cursor-not-allowed opacity-60"
                                              : ""
                                          }`}
                                        >
                                          <RadioGroupItem
                                            id={`oe-batch-${batch.batchId}`}
                                            value={batch.batchId}
                                            disabled={batch.isFull}
                                          />
                                          <span className="text-sm">
                                            Batch {batch.name}
                                            {batch.facultyName ? (
                                              <span className="text-muted-foreground ml-2">
                                                · {batch.facultyName}
                                              </span>
                                            ) : null}
                                            <span className="text-muted-foreground ml-2">
                                              {batch.isFull
                                                ? "Full"
                                                : `${batch.registeredCount} / ${batch.capacity} · ${batch.seatsLeft} seats left`}
                                            </span>
                                          </span>
                                        </label>
                                      ))}
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          <FormMessage />
                        </FormItem>
                      );
                    }}
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
