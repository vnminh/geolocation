import { PaginatedData } from "../../../shared/types/pagination";

export type RequestStatus = "decline" | "reviewing" | "accepted";

export interface UpsertRequestRow {
  id: number;
  prediction_id: number;
  user_id: number | null;
  image_url: string | null;
  cot: string | null;
  is_deleted: boolean | null;
  updated_cot: string | null;
  location: string | null;
  lat: number | null;
  lon: number | null;
  updated_lat: number;
  updated_lon: number;
  prediction_created_at: string | null;
  status: RequestStatus;
  accepted_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UpdateUpsertRequestStatusPayload {
  status: RequestStatus;
  user_id: number;
}

export interface UpdateUpsertRequestEntityPayload {
  id: number;
  status?: RequestStatus;
  user_id?: number;
  updated_lat?: number;
  updated_lon?: number;
  location?: string;
  updated_cot?: string;
}

export interface AutoCorrectUpsertRequestPayload {
  request_id: number;
  user_id: number;
}

export type UpsertRequestListEnvelopeData = PaginatedData<UpsertRequestRow>;