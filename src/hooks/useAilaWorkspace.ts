import { useEffect, useMemo, useState } from "react";
import { getDashboardMetrics } from "../services/metrics";
import { getNotifications } from "../services/notifications";
import { getAnalysisResults, startAnalysis } from "../services/analysis";
import { listUploads, submitUpload } from "../services/upload";
import type { AnalysisRequest, AnalysisResult, DashboardMetrics, NotificationItem, UploadInput, UploadRecord } from "../types/aila";
import { seedResults } from "../lib/seedData";

export function useAilaWorkspace() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedResult = useMemo(
    () => results.find((item) => item.id === selectedResultId) ?? results[0] ?? null,
    [results, selectedResultId],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [uploadData, resultData, notificationData, metricData] = await Promise.all([
          listUploads(),
          getAnalysisResults(),
          getNotifications(),
          getDashboardMetrics(),
        ]);

        if (!active) return;
        setUploads(uploadData);
        setResults(resultData.length > 0 ? resultData : seedResults);
        setNotifications(notificationData);
        setMetrics(metricData);
        setSelectedResultId((prev) => prev ?? resultData[0]?.id ?? seedResults[0]?.id ?? null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load workspace data.");
      } finally {
        if (active) setIsBooting(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const createReview = async (input: UploadInput, analysisRequest: Omit<AnalysisRequest, "uploadId">) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const upload = await submitUpload(input);
      const nextUploads = [upload, ...uploads].slice(0, 8);
      setUploads(nextUploads);

      const result = await startAnalysis({ ...analysisRequest, uploadId: upload.id });
      const nextResults = [result, ...results.filter((item) => item.uploadId !== upload.id)].slice(0, 8);
      setResults(nextResults);
      setSelectedResultId(result.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Upload failed.");
      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    uploads,
    results,
    notifications,
    metrics,
    selectedResult,
    selectedResultId,
    setSelectedResultId,
    isBooting,
    isSubmitting,
    error,
    createReview,
  };
}
