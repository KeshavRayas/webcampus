"use client";

import { authClient } from "@/lib/auth-client";
import { getApiErrorMessage } from "@/lib/api-client";
import { FacultyDetailsCard } from "./FacultyDetailsCard";
import { FacultyProfileCard } from "./FacultyProfileCard";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { QualificationsTable } from "./QualificationsTable";
import { PublicationsList } from "./PublicationsList";
import { ExperienceSection } from "./ExperienceSection";
import {
  useCreateExperience,
  useCreatePublication,
  useCreateQualification,
  useDeleteExperience,
  useDeletePublication,
  useDeleteQualification,
  useFacultyProfile,
  useUpdateExperience,
  useUpdateFacultyProfile,
  useUpdatePublication,
  useUpdateQualification,
} from "./use-faculty-profile";

export const FacultyProfileView = () => {
  const { data: session } = authClient.useSession();
  const { data: profile, isLoading, isError, error } = useFacultyProfile();

  const updateProfile = useUpdateFacultyProfile();
  const createQualification = useCreateQualification();
  const updateQualification = useUpdateQualification();
  const deleteQualification = useDeleteQualification();
  const createPublication = useCreatePublication();
  const updatePublication = useUpdatePublication();
  const deletePublication = useDeletePublication();
  const createExperience = useCreateExperience();
  const updateExperience = useUpdateExperience();
  const deleteExperience = useDeleteExperience();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">Loading faculty profile...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {getApiErrorMessage(error, "Unable to load faculty profile")}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">Faculty profile is not available.</p>
      </div>
    );
  }

  const isAdmin = session?.user.role === "admin";

  return (
    <div className="mt-2 grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
      <FacultyProfileCard profile={profile} />

      <div className="space-y-6">
        <FacultyDetailsCard
          profile={profile}
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
        />

        <PersonalInfoCard
          profile={profile}
          onSave={(payload) => {
            const nextPayload = { ...payload };
            if (!isAdmin) {
              delete (nextPayload as Record<string, unknown>).dob;
              delete (nextPayload as Record<string, unknown>).staffType;
            }
            updateProfile.mutate(nextPayload);
          }}
          isSaving={updateProfile.isPending}
        />

        <QualificationsTable
          profile={profile}
          onCreate={(payload) => createQualification.mutate(payload)}
          onUpdate={(id, payload) => updateQualification.mutate({ id, payload })}
          onDelete={(id) => deleteQualification.mutate(id)}
          isWorking={
            createQualification.isPending ||
            updateQualification.isPending ||
            deleteQualification.isPending
          }
        />

        <PublicationsList
          profile={profile}
          onCreate={(payload) => createPublication.mutate(payload)}
          onUpdate={(id, payload) => updatePublication.mutate({ id, payload })}
          onDelete={(id) => deletePublication.mutate(id)}
          isWorking={
            createPublication.isPending ||
            updatePublication.isPending ||
            deletePublication.isPending
          }
        />

        <ExperienceSection
          profile={profile}
          onCreate={(payload) => createExperience.mutate(payload)}
          onUpdate={(id, payload) => updateExperience.mutate({ id, payload })}
          onDelete={(id) => deleteExperience.mutate(id)}
          isWorking={
            createExperience.isPending ||
            updateExperience.isPending ||
            deleteExperience.isPending
          }
        />
      </div>
    </div>
  );
};
