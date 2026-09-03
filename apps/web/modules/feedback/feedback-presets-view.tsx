"use client";

import { apiClient } from "@/lib/api-client";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const blankQuestions = () =>
  Array.from({ length: 10 }, (_, index) => ({
    questionNumber: index + 1,
    questionText: "",
  }));

export function FeedbackPresetsView() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState(blankQuestions());
  const [presets, setPresets] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      questions: Array<{ questionNumber: number; questionText: string }>;
    }>
  >([]);
  const load = () =>
    void apiClient
      .get(`/admin/feedback/presets`)
      .then((response) => setPresets(response.data.data ?? []));
  useEffect(load, []);
  const save = async () => {
    try {
      await apiClient.post(`/admin/feedback/presets`, {
        name,
        description,
        questions,
      });
      toast.success("Preset created");
      setName("");
      setDescription("");
      setQuestions(blankQuestions());
      load();
    } catch (error) {
      toast.error(
        isAxiosError(error)
          ? (error.response?.data?.message ?? "Could not create preset")
          : "Could not create preset"
      );
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback Question Presets</h1>
        <p className="text-muted-foreground text-sm">
          Create reusable sets of ten questions for term configuration.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New preset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Preset name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
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
          <Button onClick={save} disabled={!name.trim()}>
            Create preset
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Available presets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {presets.length ? (
            presets.map((preset) => (
              <div key={preset.id} className="rounded-md border p-3">
                <p className="font-medium">{preset.name}</p>
                <p className="text-muted-foreground text-sm">
                  {preset.description || "No description"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {preset.questions.length} questions
                </p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No presets created yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
