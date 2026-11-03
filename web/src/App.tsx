import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { DashboardDoc } from "@dashboard/shared";
import { fetchDashboard, saveDashboard } from "./api.ts";
import {
  addWidget,
  applyGridLayouts,
  newWidgetId,
  removeWidget,
  updateSettings,
  type GridLayouts,
} from "./dashboardEdits.ts";
import { EditPanel } from "./EditPanel.tsx";
import { connectEntityStream, useConnection } from "./entityStore.ts";
import { Grid } from "./Grid.tsx";
import { getWidget, widgetTypes } from "./widgetRegistry.ts";

const DASHBOARD_KEY = ["dashboard"];

function ConnectionBanner() {
  const { stream, homeAssistant } = useConnection();
  if (stream && homeAssistant) return null;
  return (
    <div className="banner" role="status">
      {stream
        ? "Home Assistant isn't connected. Showing the last known values."
        : "Can't reach the dashboard server. Showing the last known values."}
    </div>
  );
}

export function App() {
  useEffect(connectEntityStream, []);

  const queryClient = useQueryClient();
  // A wall tablet has nobody to press retry, so keep trying until the server answers.
  const dashboard = useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: fetchDashboard,
    retry: true,
    retryDelay: 3_000,
  });

  // Non-null while editing. Nothing reaches the server until Save.
  const [draft, setDraft] = useState<DashboardDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: saveDashboard,
    onSuccess: (saved) => {
      queryClient.setQueryData(DASHBOARD_KEY, saved);
      setDraft(null);
      setSelectedId(null);
    },
  });

  const onLayoutsChange = useCallback((layouts: GridLayouts) => {
    setDraft((current) => current && applyGridLayouts(current, layouts));
  }, []);

  const onRemove = useCallback((id: string) => {
    setDraft((current) => current && removeWidget(current, id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const doc = draft ?? dashboard.data;
  if (!doc) {
    return (
      <div className="centered">
        {dashboard.failureCount > 0 ? "Can't reach the dashboard server. Retrying." : "Loading"}
      </div>
    );
  }

  const editing = draft !== null;
  const selected = draft?.widgets.find((widget) => widget.id === selectedId);
  const selectedDefinition = selected && getWidget(selected.type)?.definition;

  return (
    <div className="app">
      <ConnectionBanner />

      {editing ? (
        <div className="toolbar">
          <div className="toolbar-group">
            {widgetTypes.map(({ type, definition }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const id = newWidgetId(type);
                  setDraft(addWidget(draft, id, type, definition));
                  setSelectedId(id);
                }}
              >
                Add {definition.title.toLowerCase()}
              </button>
            ))}
          </div>
          <div className="toolbar-group">
            {save.isError && <span className="field-error">Couldn't save. Try again.</span>}
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setSelectedId(null);
                save.reset();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="edit-button" onClick={() => setDraft(doc)}>
          Edit
        </button>
      )}

      <div className="stage">
        <main className="stage-main">
          {doc.widgets.length === 0 && (
            <div className="centered">
              {editing ? "Add a tile to get started." : "Nothing here yet. Choose Edit to add a tile."}
            </div>
          )}
          <Grid
            doc={doc}
            editing={editing}
            selectedId={selectedId}
            onLayoutsChange={onLayoutsChange}
            onSelect={setSelectedId}
            onRemove={onRemove}
          />
        </main>
        {selected && selectedDefinition && (
          <EditPanel
            key={selected.id}
            widget={selected}
            definition={selectedDefinition}
            onChange={(settings) =>
              setDraft((current) => current && updateSettings(current, selected.id, settings))
            }
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
