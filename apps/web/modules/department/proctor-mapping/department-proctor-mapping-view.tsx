"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";
import { ProctorGroupsTab } from "./proctor-groups-tab";
import { ProctorStudentsTab } from "./proctor-students-tab";

export const DepartmentProctorMappingView = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Proctor Mapping</h2>
      </div>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-0">
          <ProctorGroupsTab />
        </TabsContent>
        <TabsContent value="students" className="mt-0">
          <ProctorStudentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
