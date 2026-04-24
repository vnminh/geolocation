export function Loading({ label = "Loading..." }: { label?: string }) {
  return <p className="small">{label}</p>;
}