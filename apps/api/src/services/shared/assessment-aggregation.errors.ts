import type { ComponentType } from "./assessment-aggregation.types";

export class DuplicateComponentSequenceError extends Error {
  readonly code = "DUPLICATE_COMPONENT_SEQUENCE";

  constructor(
    public readonly courseId: string,
    public readonly componentType: ComponentType,
    public readonly sequence: number,
    public readonly templateIds: string[]
  ) {
    super(
      `Duplicate ${componentType} sequence ${sequence} for course ${courseId} (templates: ${templateIds.join(", ")})`
    );
    this.name = "DuplicateComponentSequenceError";
  }
}
