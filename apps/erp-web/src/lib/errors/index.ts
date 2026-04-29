export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export function toApiError(err: unknown): { message: string; code: string; status: number } {
  if (err instanceof AppError) {
    return { message: err.message, code: err.code, status: err.statusCode };
  }
  return { message: "Internal server error", code: "INTERNAL_ERROR", status: 500 };
}

export function errorResponse(err: unknown) {
  const { message, code, status } = toApiError(err);
  return Response.json({ message, code }, { status });
}
