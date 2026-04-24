export interface PaginatedData<T> {
  items?: T[];
  total?: number;
  limit?: number;
  page?: number;
  total_pages?: number;
}
