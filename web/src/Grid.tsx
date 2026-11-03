import { useMemo } from "react";
import { Responsive, useContainerWidth } from "react-grid-layout";
import { BREAKPOINTS, GRID_COLS, type DashboardDoc } from "@dashboard/shared";
import type { GridLayouts } from "./dashboardEdits.ts";
import { WidgetHost } from "./WidgetHost.tsx";

const ROW_HEIGHT = 72;
const GAP = 12;

interface GridProps {
  doc: DashboardDoc;
  editing: boolean;
  selectedId: string | null;
  onLayoutsChange: (layouts: GridLayouts) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function Grid({ doc, editing, selectedId, onLayoutsChange, onSelect, onRemove }: GridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  const children = useMemo(
    () =>
      doc.widgets.map((widget) => (
        <div key={widget.id} className="cell" data-selected={widget.id === selectedId || undefined}>
          <div className="cell-body">
            <WidgetHost widget={widget} />
          </div>
          {editing && (
            <div className="cell-controls">
              <button type="button" onClick={() => onSelect(widget.id)}>
                Settings
              </button>
              <button type="button" onClick={() => onRemove(widget.id)}>
                Remove
              </button>
            </div>
          )}
        </div>
      )),
    [doc.widgets, editing, selectedId, onSelect, onRemove],
  );

  return (
    <div ref={containerRef} className="grid" data-editing={editing || undefined}>
      {mounted && (
        <Responsive
          width={width}
          layouts={doc.layouts}
          breakpoints={BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          margin={[GAP, GAP]}
          containerPadding={[GAP, GAP]}
          dragConfig={{ enabled: editing, cancel: ".cell-controls" }}
          resizeConfig={{ enabled: editing }}
          onLayoutChange={(_current, layouts) => {
            if (editing) onLayoutsChange(layouts);
          }}
        >
          {children}
        </Responsive>
      )}
    </div>
  );
}
