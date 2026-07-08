import { hallTicketService } from "./apps/api/src/services/shared/hall-ticket.service";
import { db } from "@webcampus/db";

async function main() {
  try {
    const term = await db.academicTerm.findFirst();
    const sem = await db.semester.findFirst();
    const dept = await db.department.findFirst();
    const sec = await db.section.findFirst();

    if (!term || !sem || !dept || !sec) {
      console.log("Missing DB data");
      return;
    }

    console.log("Using filters:", {
      academicTermId: term.id,
      semesterId: sem.id,
      departmentId: dept.id,
      sectionId: sec.id,
      search: "test",
    });

    const data = await hallTicketService.list({
      academicTermId: term.id,
      semesterId: sem.id,
      departmentId: dept.id,
      sectionId: sec.id,
      search: "test",
    });
    console.log("Success. Returned records:", data.length);
  } catch (err) {
    console.error("ERROR CAUGHT:");
    console.error(err);
    if (err instanceof Error) {
      console.error(err.stack);
    }
  } finally {
    await db.$disconnect();
  }
}

main();
