import { hallTicketService } from "./apps/api/src/services/shared/hall-ticket.service";
import { db } from "@webcampus/db";

async function main() {
  try {
    const term = await db.academicTerm.findFirst();
    if (!term) {
      console.log("No academic terms found");
      return;
    }
    console.log("Using term:", term.id);
    const data = await hallTicketService.list({ academicTermId: term.id });
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
