"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { frontendEnv } from "@webcampus/common/env";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const defaults = Array.from({ length: 10 }, (_, index) => ({
  questionNumber: index + 1,
  questionText: "",
}));

export function FeedbackConfigView() {
  const { data: loadedTerms } = useAcademicTerms({ isCurrent: true });
  const terms = loadedTerms ?? [];
  const [semesterId, setSemesterId] = useState("");
  const [questions, setQuestions] = useState(defaults);
  const [rounds, setRounds] = useState([
    { id: "", roundNumber: 1, startsAt: "", endsAt: "", isEnabled: false },
    { id: "", roundNumber: 2, startsAt: "", endsAt: "", isEnabled: false },
    { id: "", roundNumber: 3, startsAt: "", endsAt: "", isEnabled: false },
  ]);
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const semester = terms
    .flatMap((term) => term.Semester ?? [])
    .find((item) => item.id === semesterId);
  useEffect(() => {
    if (!semesterId) return;
    void axios
      .get(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/configuration/${semesterId}`,
        { withCredentials: true }
      )
      .then((response) => {
        const config = response.data.data;
        if (config?.questions?.length)
          setQuestions(
            config.questions.map(
              (question: { questionNumber: number; questionText: string }) => ({
                questionNumber: question.questionNumber,
                questionText: question.questionText,
              })
            )
          );
        if (config?.rounds?.length)
          setRounds(
            config.rounds.map(
              (round: {
                id: string;
                roundNumber: number;
                startsAt: string;
                endsAt: string;
                isEnabled: boolean;
              }) => ({
                id: round.id,
                roundNumber: round.roundNumber,
                startsAt: round.startsAt.slice(0, 16),
                endsAt: round.endsAt.slice(0, 16),
                isEnabled: round.isEnabled,
              })
            )
          );
      });
  }, [NEXT_PUBLIC_API_BASE_URL, semesterId]);
  const updateRound = async (
    round: (typeof rounds)[number],
    action: "enable" | "disable"
  ) => {
    if (!round.id) return;
    try {
      await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/rounds/${round.id}/${action}`,
        {},
        { withCredentials: true }
      );
      setRounds((current) =>
        current.map((item) =>
          item.id === round.id
            ? { ...item, isEnabled: action === "enable" }
            : item
        )
      );
      toast.success(`Round ${round.roundNumber} ${action}d`);
    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? (error.response?.data?.message ?? `Could not ${action} round`)
          : `Could not ${action} round`
      );
    }
  };
  const isRoundActive = (round: (typeof rounds)[number]) =>
    round.isEnabled &&
    round.startsAt.length > 0 &&
    round.endsAt.length > 0 &&
    new Date() >= new Date(round.startsAt) &&
    new Date() <= new Date(round.endsAt);
  const save = async () => {
    if (!semester || !semesterId) return;
    try {
      await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/questions`,
        { academicTermId: semester.academicTermId, semesterId, questions },
        { withCredentials: true }
      );
      for (const round of rounds) {
        if (!round.startsAt || !round.endsAt)
          throw new Error(`Set dates for round ${round.roundNumber}`);
        const payload = {
          academicTermId: semester.academicTermId,
          semesterId,
          roundNumber: round.roundNumber,
          startsAt: new Date(round.startsAt).toISOString(),
          endsAt: new Date(round.endsAt).toISOString(),
          isEnabled: round.isEnabled,
        };
        if (round.id)
          await axios.patch(
            `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/rounds/${round.id}`,
            payload,
            { withCredentials: true }
          );
        else {
          const response = await axios.post(
            `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/rounds`,
            payload,
            { withCredentials: true }
          );
          setRounds((current) =>
            current.map((item) =>
              item.roundNumber === round.roundNumber
                ? { ...item, id: response.data.data.id }
                : item
            )
          );
        }
      }
      toast.success("Feedback configuration saved");
    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? (error.response?.data?.message ?? "Failed to save configuration")
          : error instanceof Error
            ? error.message
            : "Failed to save configuration"
      );
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback Configuration</h1>
        <p className="text-muted-foreground text-sm">
          Select a semester, enter ten questions, set three date ranges, save,
          then enable each round when ready.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Semester</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={semesterId}
            onChange={(event) => setSemesterId(event.target.value)}
          >
            <option value="">Select semester</option>
            {terms.flatMap((term) =>
              (term.Semester ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {term.type.toUpperCase()} {term.year} - {item.programType}{" "}
                  Semester {item.semesterNumber}
                </option>
              ))
            )}
          </select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((question, index) => (
            <Input
              key={question.questionNumber}
              placeholder={`Question ${question.questionNumber}`}
              value={question.questionText}
              onChange={(event) =>
                setQuestions((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, questionText: event.target.value }
                      : item
                  )
                )
              }
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feedback Rounds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rounds.map((round, index) => {
            const active = isRoundActive(round);
            return (
              <div
                key={round.roundNumber}
                className="grid gap-3 md:grid-cols-5"
              >
                <p className="self-center font-medium">
                  Round {round.roundNumber}
                </p>
                <Input
                  type="datetime-local"
                  value={round.startsAt}
                  onChange={(event) =>
                    setRounds((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, startsAt: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Input
                  type="datetime-local"
                  value={round.endsAt}
                  onChange={(event) =>
                    setRounds((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, endsAt: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <span className="text-muted-foreground self-center text-sm">
                  {active ? "Active" : "Inactive"}
                </span>
                {round.id ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      updateRound(round, active ? "disable" : "enable")
                    }
                  >
                    {active ? "Disable" : "Enable"}
                  </Button>
                ) : (
                  <span className="text-muted-foreground self-center text-sm">
                    Save first
                  </span>
                )}
              </div>
            );
          })}
          <Button onClick={save} disabled={!semesterId}>
            Save configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
