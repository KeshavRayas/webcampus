import { db, Prisma } from "@webcampus/db";

export class AdmissionService {
  static async createAdmission(data: Prisma.AdmissionCreateInput) {
    return db.admission.create({
      data,
    });
  }

  static async getAdmissions() {
    return db.admission.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async deleteAdmission(id: number) {
    return db.admission.delete({ where: { id } });
  }
}
