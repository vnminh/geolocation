export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  status: number;
  detail: string;
}