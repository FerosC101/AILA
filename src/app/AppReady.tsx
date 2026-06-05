import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ResultsPage } from "../pages/ResultsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { useAilaWorkspace } from "../hooks/useAilaWorkspace";
import type { UploadInput, WorkspaceView } from "../types/aila";
import { audienceOptions, focusAreas } from "../lib/seedData";

export default function AppReady() {
  const [view, setView] = useState<WorkspaceView>("dashboard");
  const workspace = useAilaWorkspace();

  const handleCreateReview = async (input: UploadInput) => {
    await workspace.createReview(input, {
      focusAreas,
      audience: audienceOptions[0],
    });
  };

  return (
    <AppShell view={view} onViewChange={setView}>
      {view === "dashboard" ? (
        <DashboardPage
          uploads={workspace.uploads}
          selectedResult={workspace.selectedResult}
          notifications={workspace.notifications}
          metrics={workspace.metrics}
          isBooting={workspace.isBooting}
          isSubmitting={workspace.isSubmitting}
          error={workspace.error}
          onCreateReview={handleCreateReview}
        />
      ) : null}

      {view === "results" ? (
        <ResultsPage
          results={workspace.results}
          selectedResult={workspace.selectedResult}
          onSelectResult={workspace.setSelectedResultId}
        />
      ) : null}

      {view === "settings" ? <SettingsPage /> : null}
    </AppShell>
  );
}
