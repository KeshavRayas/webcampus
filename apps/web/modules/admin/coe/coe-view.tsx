"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios from "axios";
import { CoeActions } from "./coe-actions";
import { CoeForm } from "./coe-form";
import { CoeUser } from "./coe-types";

export const CoeView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: coes = [], isLoading } = useQuery<CoeUser[]>({
    // changed useQuery<CoeUserResponse[]> to useQuery<CoeUser[]>
    queryKey: ["admin-coes"],
    queryFn: async () => {
      const res = await axios.get(`${NEXT_PUBLIC_API_BASE_URL}/admin/coe`, {
        withCredentials: true,
      });
      return res.data.data;
    },
  });

  // renamed const columns: ColumnDef... to const CoeUserColumns
  // for better naming conventions
  const CoeUserColumns: ColumnDef<CoeUser>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => row.original.username || "-",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      id: "actions",
      cell: ({ row }) => <CoeActions user={row.original} />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-card text-card-foreground space-y-4 rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">COE Users</h3>
          <CoeForm />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            Loading COE users...
          </div>
        ) : coes && coes.length > 0 ? (
          <DataTable columns={CoeUserColumns} data={coes} />
        ) : (
          <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
            No COE users found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );

  //           <FormField
  //             control={form.control}
  //             name="photo"
  //             render={({ field }) => (
  //               <FormItem>
  //                 <FormLabel>Profile Photo</FormLabel>
  //                 <FormControl>
  //                   <Input
  //                     type="file"
  //                     accept="image/*"
  //                     onChange={(e) => {
  //                       const file = e.target.files?.[0];
  //                       if (file) {
  //                         field.onChange(file);
  //                       }
  //                     }}
  //                   />
  //                 </FormControl>
  //                 <FormMessage />
  //               </FormItem>
  //             )}
  //           />

  //           <FormField
  //             control={form.control}
  //             name="email"
  //             render={({ field }) => (
  //               <FormItem>
  //                 <FormLabel>Email *</FormLabel>
  //                 <FormControl>
  //                   <Input placeholder="jane.doe@example.com" {...field} />
  //                 </FormControl>
  //                 <FormMessage />
  //               </FormItem>
  //             )}
  //           />

  //           <FormField
  //             control={form.control}
  //             name="username"
  //             render={({ field }) => (
  //               <FormItem>
  //                 <FormLabel>Username *</FormLabel>
  //                 <FormControl>
  //                   <Input placeholder="e.g., janedoe" {...field} />
  //                 </FormControl>
  //                 <FormMessage />
  //               </FormItem>
  //             )}
  //           />

  //           <FormField
  //             control={form.control}
  //             name="password"
  //             render={({ field }) => (
  //               <FormItem>
  //                 <FormLabel>Password *</FormLabel>
  //                 <FormControl>
  //                   <div className="relative">
  //                     <Input
  //                       type={showPassword ? "text" : "password"}
  //                       placeholder="Password"
  //                       className="pr-10"
  //                       {...field}
  //                     />
  //                     <button
  //                       type="button"
  //                       onClick={() => setShowPassword(!showPassword)}
  //                       className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
  //                     >
  //                       {showPassword ? (
  //                         <EyeOff className="h-4 w-4" />
  //                       ) : (
  //                         <Eye className="h-4 w-4" />
  //                       )}
  //                     </button>
  //                   </div>
  //                 </FormControl>
  //                 <FormMessage />
  //               </FormItem>
  //             )}
  //           />
  //         </DialogForm>
  //       </div>

  //       {isLoading ? (
  //         <div className="text-muted-foreground p-8 text-center text-sm">
  //           Loading COE users...
  //         </div>
  //       ) : coes && coes.length > 0 ? (
  //         <DataTable columns={CoeUserColumns} data={coes} />
  //       ) : (
  //         <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
  //           No COE users found. Create one to get started.
  //         </div>
  //       )}
  //     </div>
  //   </div>
  // );
};
