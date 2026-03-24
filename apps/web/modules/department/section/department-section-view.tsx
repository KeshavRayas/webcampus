"use client";

import React from "react";
import { GenerateSectionsDialog } from "./generate-sections-dialog";
import { SectionCardsView } from "./section-cards-view";

export const DepartmentSectionView = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* Header with Generate action */}
      <div className="flex items-center justify-end">
        <GenerateSectionsDialog />
      </div>

      {/* Section cards with student details */}
      <SectionCardsView />
    </div>
  );
};
