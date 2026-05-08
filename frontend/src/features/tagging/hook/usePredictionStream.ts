import { useState } from "react";

import { API_BASE_URL } from "../../../shared/api/client";
import { endpoints } from "../../../shared/api/endpoints";
import {
  PredictionData,
  PredictionResponse,
  PredictionStreamEvent,
  PredictionStreamStage,
} from "../dto/tagging.dto";

interface StreamState {
  imageUrl: string;
  stages: PredictionStreamStage[];
  thinkingText: string;
  finalData: PredictionData | null;
  error: string | null;
  loading: boolean;
}

const initialState: StreamState = {
  imageUrl: "",
  stages: [],
  thinkingText: "",
  finalData: null,
  error: null,
  loading: false,
};

export function usePredictionStream() {
  const [state, setState] = useState<StreamState>(initialState);

  const consumeEvent = (evt: PredictionStreamEvent) => {
    if (evt.event === "start") {
      setState((prev) => ({ ...prev, imageUrl: evt.data.image_url }));
      return;
    }

    if (evt.event === "stage") {
      setState((prev) => {
        const nextStages = prev.stages.concat(evt.data);
        const thinkingText =
          evt.data.status === "thinking" && evt.data.text
            ? prev.thinkingText + evt.data.text
            : prev.thinkingText;
        return { ...prev, stages: nextStages, thinkingText };
      });
      return;
    }

    if (evt.event === "final") {
      setState((prev) => ({ ...prev, finalData: evt.data.data }));
      return;
    }

    if (evt.event === "error") {
      setState((prev) => ({ ...prev, error: evt.data.detail, loading: false }));
      return;
    }

    if (evt.event === "done") {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const parseSseChunk = (rawBlock: string): PredictionStreamEvent | null => {
    const lines = rawBlock.split(/\r?\n/);
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!dataLines.length) {
      return null;
    }

    try {
      const data = JSON.parse(dataLines.join("\n"));
      if (eventName === "final") {
        return { event: "final", data: data as PredictionResponse };
      }
      if (eventName === "start") {
        return { event: "start", data } as PredictionStreamEvent;
      }
      if (eventName === "stage") {
        return { event: "stage", data } as PredictionStreamEvent;
      }
      if (eventName === "done") {
        return { event: "done", data } as PredictionStreamEvent;
      }
      if (eventName === "error") {
        return { event: "error", data } as PredictionStreamEvent;
      }
      return null;
    } catch {
      return null;
    }
  };

  const runStream = async (file: File, user_id: number) => {
    setState({ ...initialState, loading: true });

    const formData = new FormData();
    formData.append("image", file);
    formData.append("user_id", String(user_id));

    const response = await fetch(`${API_BASE_URL}${endpoints.predictionStream}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok || !response.body) {
      setState((prev) => ({ ...prev, loading: false, error: `Stream failed: ${response.statusText}` }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let splitIndex = buffer.search(/\r?\n\r?\n/);
      while (splitIndex !== -1) {
        const block = buffer.slice(0, splitIndex).trim();
        const separatorMatch = buffer.slice(splitIndex).match(/^\r?\n\r?\n/);
        const separatorLength = separatorMatch ? separatorMatch[0].length : 2;
        buffer = buffer.slice(splitIndex + separatorLength);

        if (block) {
          const evt = parseSseChunk(block);
          if (evt) {
            consumeEvent(evt);
          }
        }
        splitIndex = buffer.search(/\r?\n\r?\n/);
      }
    }

    const trailingBlock = buffer.trim();
    if (trailingBlock) {
      const evt = parseSseChunk(trailingBlock);
      if (evt) {
        consumeEvent(evt);
      }
    }

    setState((prev) => ({ ...prev, loading: false }));
  };

  return {
    ...state,
    runStream,
  };
}