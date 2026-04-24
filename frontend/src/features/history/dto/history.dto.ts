import { PaginatedData } from "../../../shared/types/pagination";

export interface HistoryRow {
  id: number;
  user_id: number;
  image_url: string;
  cot: string | null;
  lat: number;
  lon: number;
  is_deleted: boolean;
  created_at: string | null;
}

export interface HistoryDeleteResponse {
  id: number;
  is_deleted: boolean;
}

export type HistoryListEnvelopeData = PaginatedData<HistoryRow>;
