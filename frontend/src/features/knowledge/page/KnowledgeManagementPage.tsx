import { useEffect, useMemo } from "react";

import { useAuth } from "../../../shared/auth/context";
import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { Loading } from "../../../shared/components/feedback/Loading";
import { PaginationControls } from "../../../shared/components/layout/PaginationControls";
import { KnowledgeIndex } from "../dto/knowledge.dto";
import { useKnowledgeSearch } from "../hook/useKnowledgeSearch";

export function KnowledgeManagementPage() {
  const { user } = useAuth();
  const {
    rows,
    page,
    limit,
    total,
    totalPages,
    loading,
    deletingId,
    error,
    file,
    indexName,
    search,
    setPage,
    selectFile,
    selectIndex,
    deletePoint,
  } = useKnowledgeSearch(user?.id);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (user?.role !== "admin") {
    return <ErrorState message="Access denied: admin only." />;
  }

  return (
    <div className="grid knowledge-page">
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Knowledge Management</h3>
        <p className="small">Search similar images in mp16_geo_multistage. Results are limited to 10 per page.</p>

        <form
          className="knowledge-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void search(1);
          }}
        >
          <label className="field">
            Query image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          <label className="field">
            Index name
            <select
              value={indexName}
              onChange={(event) => selectIndex(event.target.value as KnowledgeIndex)}
            >
              <option value="dino_emb">dino_emb</option>
              <option value="geoclip_img_emb">geoclip_img_emb</option>
            </select>
          </label>
          <button type="submit" disabled={!file || loading}>
            {loading ? "Searching..." : "Search knowledge"}
          </button>
        </form>

        {previewUrl && <img className="knowledge-query-preview" src={previewUrl} alt="Knowledge query preview" />}
        {loading && <Loading label="Embedding image and searching Qdrant..." />}
        {error && <ErrorState message={error} />}
      </section>

      {!!rows.length && (
        <section className="card">
          <div className="knowledge-results-header">
            <h3 style={{ margin: 0 }}>Search Results</h3>
            <span className="small">Index: {indexName}</span>
          </div>

          <div className="knowledge-results-grid">
            {rows.map((row) => (
              <article className="knowledge-result-card" key={row.id}>
                {row.image_url ? (
                  <img src={row.image_url} alt={`Qdrant result ${row.id}`} />
                ) : (
                  <div className="knowledge-image-missing">No accessible image URL in metadata</div>
                )}
                <div className="knowledge-result-body">
                  <strong>Score: {row.score.toFixed(6)}</strong>
                  <span className="small">ID: {row.id}</span>
                  <details>
                    <summary>Metadata</summary>
                    <pre>{JSON.stringify(row.payload, null, 2)}</pre>
                  </details>
                  <button
                    type="button"
                    className="knowledge-delete-button"
                    disabled={deletingId !== null}
                    onClick={() => {
                      if (window.confirm(`Delete Qdrant point ${row.id}? This cannot be undone.`)) {
                        void deletePoint(row.id);
                      }
                    }}
                  >
                    {deletingId === row.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            limit={limit}
            totalRows={total}
            rowsOnPage={rows.length}
            loading={loading}
            onPageChange={setPage}
          />
        </section>
      )}
    </div>
  );
}
