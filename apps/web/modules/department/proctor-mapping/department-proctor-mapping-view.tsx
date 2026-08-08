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
        <TabsList className="mb-4 w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="groups"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium shadow-none transition-none focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Groups
          </TabsTrigger>
          <TabsTrigger
            value="students"
            className="data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium shadow-none transition-none focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Students
          </TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-0 border-0 p-0 outline-none">
          <ProctorGroupsTab />
        </TabsContent>
        <TabsContent
          value="students"
          className="mt-0 border-0 p-0 outline-none"
        >
          <ProctorStudentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
