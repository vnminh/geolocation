import { PaginatedData } from "../../../shared/types/pagination";

export type KnowledgeIndex = "dino_emb" | "geoclip_img_emb";

export interface KnowledgeResult {
  id: string;
  score: number;
  image_url: string | null;
  payload: Record<string, unknown>;
}

export interface KnowledgeSearchData extends PaginatedData<KnowledgeResult> {
  index_name: KnowledgeIndex;
  collection: string;
}

export interface KnowledgeDeleteData {
  id: string;
  deleted: boolean;
}
