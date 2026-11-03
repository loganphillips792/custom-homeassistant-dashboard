import {
  BREAKPOINT_NAMES,
  GRID_COLS,
  type DashboardDoc,
  type LayoutItem,
  type WidgetDefinition,
} from "@dashboard/shared";

type GridItem = Pick<LayoutItem, "i" | "x" | "y" | "w" | "h">;
export type GridLayouts = Partial<Record<string, readonly GridItem[]>>;

export function newWidgetId(type: string): string {
  // Not crypto.randomUUID: browsers only offer it on HTTPS, and the tablet loads this over HTTP.
  return `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Adds a widget to every breakpoint, below whatever is already there. */
export function addWidget(
  doc: DashboardDoc,
  id: string,
  type: string,
  definition: Pick<WidgetDefinition, "defaultSize">,
): DashboardDoc {
  const layouts = { ...doc.layouts };
  for (const breakpoint of BREAKPOINT_NAMES) {
    const items = layouts[breakpoint];
    layouts[breakpoint] = [
      ...items,
      {
        i: id,
        x: 0,
        y: Math.max(0, ...items.map((item) => item.y + item.h)),
        w: Math.min(definition.defaultSize.w, GRID_COLS[breakpoint]),
        h: definition.defaultSize.h,
      },
    ];
  }
  return { widgets: [...doc.widgets, { id, type, settings: {} }], layouts };
}

export function removeWidget(doc: DashboardDoc, id: string): DashboardDoc {
  const layouts = { ...doc.layouts };
  for (const breakpoint of BREAKPOINT_NAMES) {
    layouts[breakpoint] = layouts[breakpoint].filter((item) => item.i !== id);
  }
  return { widgets: doc.widgets.filter((widget) => widget.id !== id), layouts };
}

export function updateSettings(
  doc: DashboardDoc,
  id: string,
  settings: Record<string, unknown>,
): DashboardDoc {
  return {
    ...doc,
    widgets: doc.widgets.map((widget) => (widget.id === id ? { ...widget, settings } : widget)),
  };
}

/**
 * Merges what the grid reports into the document. The grid can report just before it has caught
 * up with an added or removed widget, so items for unknown widgets are dropped and widgets it
 * didn't mention keep their position. Returns the same document if nothing moved.
 */
export function applyGridLayouts(doc: DashboardDoc, grid: GridLayouts): DashboardDoc {
  const ids = new Set(doc.widgets.map((widget) => widget.id));
  const layouts = { ...doc.layouts };
  for (const breakpoint of BREAKPOINT_NAMES) {
    const reported = grid[breakpoint];
    if (!reported) continue;
    const items: LayoutItem[] = reported
      .filter((item) => ids.has(item.i))
      .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
    const mentioned = new Set(items.map((item) => item.i));
    layouts[breakpoint] = [
      ...items,
      ...layouts[breakpoint].filter((item) => !mentioned.has(item.i)),
    ];
  }
  return JSON.stringify(layouts) === JSON.stringify(doc.layouts) ? doc : { ...doc, layouts };
}
