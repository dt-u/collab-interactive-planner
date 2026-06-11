export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponseSuccess<TData = unknown> {
  success: true;
  data: TData;
  metadata?: PaginationMetadata;
  error?: null;
}

export interface ApiResponseError {
  success: false;
  data?: null;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export type ApiResponse<TData = unknown> =
  | ApiResponseSuccess<TData>
  | ApiResponseError;
