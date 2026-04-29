import type { ZodIssue } from "zod";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;

  constructor(resource: string, id?: string) {
    super(id ? `${resource} '${id}' not found` : `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;
  readonly issues: ZodIssue[];

  constructor(message: string, issues: ZodIssue[] = []) {
    super(message);
    this.issues = issues;
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
  readonly statusCode = 401;

  constructor(message = "Unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly statusCode = 403;

  constructor(message = "Forbidden") {
    super(message);
  }
}

export class BadRequestError extends AppError {
  readonly code = "BAD_REQUEST";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toApiError(error: unknown): {
  message: string;
  code: string;
  status: ContentfulStatusCode;
} {
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.statusCode as ContentfulStatusCode,
    };
  }
  if (error instanceof Error) {
    return { message: "Internal server error", code: "INTERNAL_ERROR", status: 500 };
  }
  return { message: "Internal server error", code: "INTERNAL_ERROR", status: 500 };
}
