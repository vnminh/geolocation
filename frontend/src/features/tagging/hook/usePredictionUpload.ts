import { useMemo, useState } from "react";

export function usePredictionUpload() {
  const [file, setFile] = useState<File | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  const setImageFile = (next: File | null) => {
    if (next && !next.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }
    setFile(next);
  };

  return {
    file,
    previewUrl,
    setImageFile,
  };
}