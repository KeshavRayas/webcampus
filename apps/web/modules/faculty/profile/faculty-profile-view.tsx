"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { ExperienceSection } from "./ExperienceSection";
import { FacultyDetailsCard } from "./FacultyDetailsCard";
import { FacultyProfileCard } from "./FacultyProfileCard";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { PublicationsList } from "./PublicationsList";
import { QualificationsTable } from "./QualificationsTable";
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

export const FacultyProfileView = ({
  facultyId,
}: { facultyId?: string } = {}) => {
  const { data: session } = authClient.useSession();
  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useFacultyProfile(facultyId);
  const isReadOnly = !!facultyId;

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
        <p className="text-muted-foreground text-sm">
          Loading faculty profile...
        </p>
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
        <p className="text-muted-foreground text-sm">
          Faculty profile is not available.
        </p>
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
          isReadOnly={isReadOnly}
          onSave={
            isReadOnly ? () => {} : (payload) => updateProfile.mutate(payload)
          }
          isSaving={updateProfile.isPending}
        />

        <PersonalInfoCard
          profile={profile}
          onSave={
            isReadOnly
              ? () => {}
              : (payload) => {
                  const nextPayload = { ...payload };
                  if (!isAdmin) {
                    delete (nextPayload as Record<string, unknown>).dob;
                    delete (nextPayload as Record<string, unknown>).staffType;
                  }
                  updateProfile.mutate(nextPayload);
                }
          }
          isSaving={updateProfile.isPending}
        />

        <QualificationsTable
          profile={profile}
          onCreate={
            isReadOnly
              ? () => {}
              : (payload) => createQualification.mutate(payload)
          }
          onUpdate={
            isReadOnly
              ? () => {}
              : (id, payload) => updateQualification.mutate({ id, payload })
          }
          onDelete={
            isReadOnly ? () => {} : (id) => deleteQualification.mutate(id)
          }
          isWorking={
            createQualification.isPending ||
            updateQualification.isPending ||
            deleteQualification.isPending
          }
        />

        <PublicationsList
          profile={profile}
          onCreate={
            isReadOnly
              ? () => {}
              : (payload) => createPublication.mutate(payload)
          }
          onUpdate={
            isReadOnly
              ? () => {}
              : (id, payload) => updatePublication.mutate({ id, payload })
          }
          onDelete={
            isReadOnly ? () => {} : (id) => deletePublication.mutate(id)
          }
          isWorking={
            createPublication.isPending ||
            updatePublication.isPending ||
            deletePublication.isPending
          }
        />

        <ExperienceSection
          profile={profile}
          onCreate={
            isReadOnly
              ? () => {}
              : (payload) => createExperience.mutate(payload)
          }
          onUpdate={
            isReadOnly
              ? () => {}
              : (id, payload) => updateExperience.mutate({ id, payload })
          }
          onDelete={isReadOnly ? () => {} : (id) => deleteExperience.mutate(id)}
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
