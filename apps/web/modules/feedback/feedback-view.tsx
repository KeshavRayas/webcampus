"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Label } from "@webcampus/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@webcampus/ui/components/radio-group";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

type Question = { id: string; questionNumber: number; questionText: string };
type Round = {
  id: string;
  roundNumber: number;
  name: string;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
  isActive: boolean;
  questions: Question[];
};
type Assignment = {
  id: string;
  electiveBatchFacultyId?: string;
  assignmentType: string;
  course: { code: string; name: string };
  faculty: { shortName: string; user: { name: string } };
  section: { name: string };
  batch: { name: string } | null;
  submissions: { feedbackRoundId: string }[];
};

const options = [
  [5, "Excellent"],
  [4, "Very Good"],
  [3, "Good"],
  [2, "Fair"],
  [1, "Poor"],
] as const;

export function FeedbackView() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<{
    assignment: Assignment;
    round: Round;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-feedback"],
    queryFn: async () =>
      (await apiClient.get(`/student/feedback`)).data.data as {
        rounds: Round[];
        assignments: Assignment[];
      },
  });

  useEffect(() => {
    if (!data) return;
    const active = data.rounds.filter((round) => round.isActive);
    setActiveRoundId((current) =>
      current && active.some((round) => round.id === current)
        ? current
        : (active[0]?.id ?? null)
    );
  }, [data]);
  const submit = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a course first");
      if (Object.keys(answers).length !== selected.round.questions.length)
        throw new Error("Answer all questions before submitting");
      return apiClient.post(`/student/feedback/submit`, {
        ...(selected.assignment.electiveBatchFacultyId
          ? {
              electiveBatchFacultyId:
                selected.assignment.electiveBatchFacultyId,
            }
          : { courseAssignmentId: selected.assignment.id }),
        feedbackRoundId: selected.round.id,
        answers: selected.round.questions.map((question) => ({
          questionId: question.id,
          score: answers[question.id],
        })),
      });
    },
    onSuccess: () => {
      toast.success("Feedback submitted successfully");
      setSelected(null);
      setAnswers({});
      queryClient.invalidateQueries({ queryKey: ["student-feedback"] });
    },
    onError: (error: unknown) =>
      toast.error(
        isAxiosError(error)
          ? (error.response?.data?.message ?? error.response?.data?.error)
          : error instanceof Error
            ? error.message
            : "Could not submit feedback"
      ),
  });

  if (isLoading) return <div className="p-6 text-sm">Loading feedback...</div>;
  if (isError || !data)
    return (
      <div className="text-destructive p-6 text-sm">
        Unable to load feedback.
      </div>
    );

  const activeRounds = data.rounds.filter((round) => round.isActive);
  const activeRound =
    activeRounds.find((round) => round.id === activeRoundId) ?? activeRounds[0];
  if (selected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {selected.assignment.course.code} -{" "}
            {selected.assignment.assignmentType} feedback
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Round:{" "}
            {selected.round.name || `Round ${selected.round.roundNumber}`} |
            Faculty: {selected.assignment.faculty.user.name} | Section:{" "}
            {selected.assignment.section.name}
            {selected.assignment.batch
              ? ` | Batch: ${selected.assignment.batch.name}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {selected.round.questions.map((question) => (
            <div key={question.id} className="space-y-3">
              <Label>
                {question.questionNumber}. {question.questionText}
              </Label>
              <RadioGroup
                value={answers[question.id]?.toString()}
                onValueChange={(value) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: Number(value),
                  }))
                }
                className="grid gap-2 sm:grid-cols-5"
              >
                {options.map(([score, label]) => (
                  <Label
                    key={score}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                  >
                    <RadioGroupItem value={score.toString()} />
                    {label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Submitting..." : "Submit feedback"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Course Feedback</h1>
        <p className="text-muted-foreground text-sm">
          Submit one immutable evaluation for each eligible theory and lab
          assignment.
        </p>
      </div>
      {!activeRound ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            No feedback round is currently open.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {activeRounds.map((round) => (
              <Button
                key={round.id}
                variant={round.id === activeRound.id ? "default" : "outline"}
                onClick={() => setActiveRoundId(round.id)}
              >
                {round.name || `Round ${round.roundNumber}`}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.assignments.map((assignment) => {
              const submitted = assignment.submissions.some(
                (submission) => submission.feedbackRoundId === activeRound.id
              );
              return (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle>
                      {assignment.course.code} - {assignment.assignmentType}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {assignment.course.name}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>Faculty: {assignment.faculty.user.name}</p>
                    <p>
                      Section: {assignment.section.name}
                      {assignment.batch
                        ? ` | Batch: ${assignment.batch.name}`
                        : ""}
                    </p>
                    {submitted ? (
                      <p className="text-primary font-medium">Submitted</p>
                    ) : (
                      <Button
                        onClick={() => {
                          setSelected({ assignment, round: activeRound });
                          setAnswers({});
                        }}
                      >
                        Give feedback
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
