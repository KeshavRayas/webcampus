import { AuditAction, AuditEntityType, db, Prisma } from "@webcampus/db";

type Tx = Prisma.TransactionClient;

export class OptimisticLockError extends Error {
  statusCode = 409;
  currentVersion: number;

  constructor(message: string, currentVersion: number) {
    super(message);
    this.currentVersion = currentVersion;
    this.name = "OptimisticLockError";
  }
}

export type AuditLogEntry = {
  entityType:
    | "COURSE"
    | "COURSE_ASSIGNMENT"
    | "COORDINATOR"
    | "BATCH"
    | "ASSESSMENT"
    | "STUDENT_PROFILE";
  entityId: string;
  courseId?: string;
  action:
    | "SUPER_EDIT"
    | "UPSERT_MAPPING"
    | "DELETE_MAPPING"
    | "UPDATE_COORDINATOR"
    | "UPDATE_STUDENT_PROFILE";
};

export type FieldChange = {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
};

export type LogChangesInput = AuditLogEntry & {
  changes: FieldChange[];
  adminUserId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function diffFields<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: T,
  trackableFields: readonly (keyof T & string)[]
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of trackableFields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        fieldName: field,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
      });
    }
  }

  return changes;
}

export function diffLists<T>(
  oldList: T[],
  newList: T[],
  fieldName: string,
  idExtractor: (item: T) => string,
  nameExtractor?: (item: T) => string
): FieldChange | null {
  const oldIds = new Set(oldList.map(idExtractor));
  const newIds = new Set(newList.map(idExtractor));

  if (setsEqual(oldIds, newIds)) return null;

  const formatList = (items: T[]) =>
    nameExtractor ? items.map(nameExtractor) : items.map(idExtractor);

  return {
    fieldName,
    oldValue: formatList(oldList),
    newValue: formatList(newList),
  };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export async function logChanges(
  input: LogChangesInput,
  tx?: Tx
): Promise<{ changeGroupId: string }> {
  const client = tx ?? db;
  const changeGroupId = crypto.randomUUID();

  if (input.changes.length === 0) {
    return { changeGroupId };
  }

  const rows = input.changes.map((change) => ({
    changeGroupId,
    entityId: input.entityId,
    entityType: input.entityType as AuditEntityType,
    courseId: input.courseId,
    fieldName: change.fieldName,
    oldValue: change.oldValue as Prisma.InputJsonValue,
    newValue: change.newValue as Prisma.InputJsonValue,
    action: input.action as AuditAction,
    reason: input.reason ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    adminUserId: input.adminUserId,
  }));

  await client.adminEditLog.createMany({ data: rows });

  return { changeGroupId };
}

export async function getByCourse(
  courseId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResult<unknown>> {
  const where = { courseId };

  const [data, total] = await Promise.all([
    db.adminEditLog.findMany({
      where,
      orderBy: { editedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        adminUser: {
          select: { name: true, username: true },
        },
      },
    }),
    db.adminEditLog.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getByEntity(
  entityType: string,
  entityId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResult<unknown>> {
  const where = { entityType: entityType as AuditEntityType, entityId };

  const [data, total] = await Promise.all([
    db.adminEditLog.findMany({
      where,
      orderBy: { editedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        adminUser: {
          select: { name: true, username: true },
        },
      },
    }),
    db.adminEditLog.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getChangeGroup(changeGroupId: string) {
  return db.adminEditLog.findMany({
    where: { changeGroupId },
    orderBy: { editedAt: "asc" },
    include: {
      adminUser: {
        select: { name: true, username: true },
      },
    },
  });
}

export async function incrementVersion(
  courseId: string,
  adminUserId: string | null,
  tx?: Tx
): Promise<number | null> {
  const client = tx ?? db;
  const expectedVersion = await client.course.findUnique({
    where: { id: courseId },
    select: { version: true },
  });

  if (!expectedVersion) return null;

  const newVersion = expectedVersion.version + 1;

  await client.course.update({
    where: { id: courseId },
    data: {
      version: newVersion,
      lastOverrideAt: new Date(),
      lastOverrideById: adminUserId,
      overrideCount: { increment: 1 },
      hasPostApprovalEdits: true,
    },
  });

  return newVersion;
}

export async function checkAndIncrementOptimisticVersion(
  courseId: string,
  clientVersion: number,
  adminUserId: string | null,
  tx?: Tx
): Promise<number> {
  const client = tx ?? db;

  const result = await client.course.updateMany({
    where: {
      id: courseId,
      version: clientVersion,
    },
    data: {
      version: { increment: 1 },
      lastOverrideAt: new Date(),
      lastOverrideById: adminUserId,
      overrideCount: { increment: 1 },
      hasPostApprovalEdits: true,
    },
  });

  if (result.count === 0) {
    const current = await client.course.findUnique({
      where: { id: courseId },
      select: { version: true },
    });

    throw new OptimisticLockError(
      "Course has been modified by another administrator. Please refresh.",
      current?.version ?? clientVersion
    );
  }

  const updated = await client.course.findUnique({
    where: { id: courseId },
    select: { version: true },
  });

  return updated!.version;
}
