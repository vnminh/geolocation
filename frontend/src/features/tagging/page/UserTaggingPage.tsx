import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorState } from "../../../shared/components/feedback/ErrorState";
import { routePaths } from "../../../shared/constants/routePaths";
import { StageRow } from "../../../shared/components/feedback/StageRow";
import { PredictionData, PredictionStreamStage } from "../dto/tagging.dto";
import { usePredictionUpload } from "../hook/usePredictionUpload";
import { usePredictionStream } from "../hook/usePredictionStream";
interface PersistedPredictionView {
  previewUrl: string;
  imageUrl: string;
  thinkingText: string;
  finalData: PredictionData | null;
  stages: PredictionStreamStage[];
}
import { predictionViewKey, useAuth } from "../../../shared/auth/context";


const EMPTY_PERSISTED_PREDICTION_VIEW: PersistedPredictionView = {
  previewUrl: "",
  imageUrl: "",
  thinkingText: "",
  finalData: null,
  stages: [],
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Cannot read preview image"));
      }
    };
    reader.onerror = () => reject(new Error("Cannot read preview image"));
    reader.readAsDataURL(file);
  });
  
  const readPersistedPredictionView = (key:string): PersistedPredictionView => {
    if (typeof window === "undefined") {
      return EMPTY_PERSISTED_PREDICTION_VIEW;
    }
    
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) {
        return EMPTY_PERSISTED_PREDICTION_VIEW;
      }
      
      const parsed = JSON.parse(raw) as Partial<PersistedPredictionView>;
      const stages = Array.isArray(parsed.stages) ? (parsed.stages as PredictionStreamStage[]) : [];
      const finalData =
      parsed.finalData && typeof parsed.finalData === "object"
      ? (parsed.finalData as PredictionData)
      : null;
      
      return {
        previewUrl: typeof parsed.previewUrl === "string" ? parsed.previewUrl : "",
        imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
        thinkingText: typeof parsed.thinkingText === "string" ? parsed.thinkingText : "",
        finalData,
        stages,
      };
    } catch {
      return EMPTY_PERSISTED_PREDICTION_VIEW;
    }
  };

export function UserTaggingPage() {
  const { user } = useAuth();
  const storageKey = predictionViewKey(user?.id.toString() ?? "guest");
  
  const navigate = useNavigate();
  const { file, previewUrl, setImageFile } = usePredictionUpload();
  const { imageUrl, stages, thinkingText, finalData, loading, error, runStream } = usePredictionStream();
  const [showThinking, setShowThinking] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedView, setSavedView] = useState<PersistedPredictionView>(
    () => readPersistedPredictionView(storageKey),
  );
  
  const savedPreviewUrl = savedView.previewUrl;
  const savedImageUrl = savedView.imageUrl;
  const savedThinkingText = savedView.thinkingText;
  const savedFinalData = savedView.finalData;
  const savedStages = savedView.stages;
  
  const currentPreviewUrl = previewUrl || savedPreviewUrl;
  const currentImageUrl = imageUrl || savedImageUrl;
  const currentThinkingText = thinkingText || savedThinkingText;
  const currentFinalData = finalData || savedFinalData;
  const currentStages = stages.length ? stages : savedStages;
  
  const isFirstUse =
  !file &&
  !loading &&
  !currentPreviewUrl &&
    !currentThinkingText.trim() &&
    !currentFinalData &&
    !currentImageUrl &&
    currentStages.length === 0;

  useEffect(() => {
    setSavedView(readPersistedPredictionView(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (previewUrl) {
      setSavedView((prev) =>
        prev.previewUrl === previewUrl ? prev : { ...prev, previewUrl },
      );
    }
  }, [previewUrl]);

  useEffect(() => {
    if (imageUrl) {
      setSavedView((prev) =>
        prev.imageUrl === imageUrl ? prev : { ...prev, imageUrl },
      );
    }
  }, [imageUrl]);

  useEffect(() => {
    if (thinkingText.trim()) {
      setSavedView((prev) =>
        prev.thinkingText === thinkingText ? prev : { ...prev, thinkingText },
      );
    }
  }, [thinkingText]);

  useEffect(() => {
    if (finalData) {
      setSavedView((prev) => ({ ...prev, finalData }));
    }
  }, [finalData]);

  useEffect(() => {
    if (stages.length) {
      setSavedView((prev) => ({ ...prev, stages }));
    }
  }, [stages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isEmptySavedView =
      !savedView.previewUrl &&
      !savedView.imageUrl &&
      !savedView.thinkingText &&
      !savedView.finalData &&
      savedView.stages.length === 0;

    if (isEmptySavedView) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(savedView));
  }, [savedView]);

  const retrievalMessage = useMemo(() => {
    const retrievalCompleted = currentStages.find(
      (stage) => stage.name === "retrieval" && stage.status === "completed",
    );
    const count = retrievalCompleted?.top_count ?? -1;
    return count === -1 ? "retrieving ..." : `retrieve ${count} candidate location`;
  }, [currentStages]);

  useEffect(() => {
    if (loading && currentThinkingText.trim()) {
      setShowThinking(true);
    }
    if (!loading) {
      setShowThinking(false);
    }
  }, [loading, currentThinkingText]);

  const onPickFile = async (nextFile: File | null) => {
    try {
      setLocalError(null);
      setImageFile(nextFile);
      if (nextFile) {
        if (!user) {
          throw new Error("Missing user session");
        }
        const nextPreviewUrl = await fileToDataUrl(nextFile);
        setSavedView({ ...EMPTY_PERSISTED_PREDICTION_VIEW, previewUrl: nextPreviewUrl });
        await runStream(nextFile, user.id);
      }
    } catch (err) {
      setLocalError((err as Error).message);
    }
  };

  const handleViewOnMap = () => {
    const lat = currentFinalData?.answer.lat;
    const lon = currentFinalData?.answer.lon;
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return;
    }

    navigate(`${routePaths.userMap}?lat=${lat}&lon=${lon}`);
  };

  return (
    <div className="claude-chat-wrap">
      <section className={`claude-chat-thread card ${isFirstUse ? "first-use" : ""}`}>
        {isFirstUse ? (
          <div className="claude-msg assistant">
            <div className="claude-msg-bubble assistant">
              <p className="empty-conversation-title">Geo System</p>
              <p className="empty-conversation-subtitle">upload image and check where is it</p>
            </div>
          </div>
        ) : (
          <>
            <div className="claude-msg user">
              <div className="claude-msg-bubble user">
                <p>Infer geolocation from this image.</p>
                {currentPreviewUrl && <img src={currentPreviewUrl} alt="preview" className="chat-preview" />}
              </div>
            </div>

            <div className="claude-msg assistant">
              <div className="claude-msg-bubble assistant">

                {/* Stage tracker */}
                <div className="stage-tracker">
                  <StageRow
                    status="done"
                    label="Image uploaded"
                  />
                  <StageRow
                    status={!currentStages.find(s => s.name === "retrieval" && s.status === "completed") ? "active" : "done"}
                    label="Retrieving candidates"
                    badge={
                      currentStages.find(s => s.name === "retrieval" && s.status === "completed")
                        ? `${currentStages.find(s => s.name === "retrieval" && s.status === "completed")?.top_count ?? 0} found`
                        : undefined
                    }
                    showDots={!currentStages.find(s => s.name === "retrieval" && s.status === "completed")}
                  />
                  <StageRow
                    status={
                      !loading && currentFinalData ? "done"
                      : loading && !currentThinkingText.trim() ? "active"
                      : "pending"
                    }
                    label="Analyzing location"
                    showDots={ loading && !currentThinkingText.trim()}
                  />
                  <StageRow
                    status={!loading && currentFinalData ? "done" : "pending"}
                    label="Finalizing prediction"
                  />
                </div>

                {/* Thinking toggle */}
                {currentThinkingText.trim() && (
                  <div className="claude-thinking-wrap">
                    <div className="claude-thinking-header">
                      <span className="claude-thinking-label">Thinking stream</span>
                      <button
                        type="button"
                        className="thinking-toggle"
                        onClick={() => setShowThinking(prev => !prev)}
                      >
                        {showThinking ? "Hide" : "Show"}
                      </button>
                    </div>
                    {showThinking && (
                      <pre className="claude-thinking-stream">{currentThinkingText}</pre>
                    )}
                  </div>
                )}

                {/* Final result */}
                {!loading && currentFinalData && (
                  <div className="claude-final-output">
                    <p>lat: {currentFinalData.answer.lat ?? "N/A"}</p>
                    <p>lon: {currentFinalData.answer.lon ?? "N/A"}</p>
                    {currentFinalData.answer.lat !== null && currentFinalData.answer.lon !== null && (
                      <button type="button" onClick={handleViewOnMap}>
                        View on Map
                      </button>
                    )}
                  </div>
                )}

                {(error || localError) && <ErrorState message={error || localError || ""} />}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="claude-chat-input card">
        <label className="browse-only-label" htmlFor="browse-image-input">
          Browse file
        </label>
        <input
          id="browse-image-input"
          className="browse-only-input"
          type="file"
          accept="image/*"
          disabled={loading}
          onChange={(e) => {
            void onPickFile(e.target.files?.[0] ?? null);
          }}
        />
        <p className="small">{loading ? "streaming output..." : file ? file.name : "choose image to start"}</p>
      </section>
    </div>
  );
}