/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import axios from "axios";

export const StudentProctorView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: proctorGroup, isLoading } = useQuery({
    queryKey: ["student-proctor"],
    queryFn: async () => {
      const res = await axios.get<any>(
        `${NEXT_PUBLIC_API_BASE_URL}/student/proctor`,
        { withCredentials: true }
      );
      return res.data.data;
    },
  });

  if (isLoading) return <div className="p-4">Loading proctor details...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Proctor Details</h2>
      {!proctorGroup ? (
        <p className="text-muted-foreground text-sm">
          No proctor assigned yet.
        </p>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Group: {proctorGroup.groupNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            {proctorGroup.faculty ? (
              <div className="space-y-2">
                <p>
                  <strong>Name:</strong> {proctorGroup.faculty.user?.name}
                </p>
                <p>
                  <strong>Email:</strong> {proctorGroup.faculty.user?.email}
                </p>
                <p>
                  <strong>Phone:</strong>{" "}
                  {proctorGroup.faculty.user?.phoneNumber || "N/A"}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No faculty assigned to this group yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
