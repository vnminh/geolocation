import { ApiEnvelope } from "../../../shared/types/envelope";

export interface PredictionAnswer {
  lat: number | null;
  lon: number | null;
  cot: string;
  model_output: string | null;
}

export interface PredictionData {
  image_url: string;
  answer: PredictionAnswer;
}

export type PredictionResponse = ApiEnvelope<PredictionData>;

export interface PredictionStreamStart {
  success: boolean;
  image_url: string;
}

export interface PredictionStreamStage {
  name: "retrieval" | "predict";
  status: "started" | "thinking" | "completed";
  text?: string;
  top_count?: number;
  mean_lat?: number | null;
  mean_lon?: number | null;
  lat?: number | null;
  lon?: number | null;
}

export interface PredictionStreamError {
  success: false;
  detail: string;
}

export interface PredictionStreamDone {
  success: true;
}

export type PredictionStreamEvent =
  | { event: "start"; data: PredictionStreamStart }
  | { event: "stage"; data: PredictionStreamStage }
  | { event: "final"; data: PredictionResponse }
  | { event: "done"; data: PredictionStreamDone }
  | { event: "error"; data: PredictionStreamError };