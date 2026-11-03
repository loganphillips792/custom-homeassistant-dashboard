import { z } from "zod";

export const BREAKPOINT_NAMES = ["lg", "md", "sm"] as const;
export type Breakpoint = (typeof BREAKPOINT_NAMES)[number];

/** Minimum grid width in pixels for each breakpoint. */
export const BREAKPOINTS: Record<Breakpoint, number> = { lg: 1100, md: 700, sm: 0 };
export const GRID_COLS: Record<Breakpoint, number> = { lg: 12, md: 8, sm: 4 };

const gridUnit = z.number().int().min(0);

/** Unknown keys that react-grid-layout adds at runtime, such as `moved`, are stripped. */
export const LayoutItemSchema = z.object({
  i: z.string().min(1),
  x: gridUnit,
  y: gridUnit,
  w: gridUnit.min(1),
  h: gridUnit.min(1),
  minW: gridUnit.optional(),
  minH: gridUnit.optional(),
});
export type LayoutItem = z.infer<typeof LayoutItemSchema>;

export const WidgetInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  settings: z.record(z.string(), z.unknown()),
});
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;

export const DashboardDocSchema = z
  .object({
    widgets: z.array(WidgetInstanceSchema),
    layouts: z.object({
      lg: z.array(LayoutItemSchema),
      md: z.array(LayoutItemSchema),
      sm: z.array(LayoutItemSchema),
    }),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    doc.widgets.forEach((widget, index) => {
      if (ids.has(widget.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate widget id "${widget.id}"`,
          path: ["widgets", index, "id"],
        });
      }
      ids.add(widget.id);
    });
    for (const breakpoint of BREAKPOINT_NAMES) {
      doc.layouts[breakpoint].forEach((item, index) => {
        if (!ids.has(item.i)) {
          ctx.addIssue({
            code: "custom",
            message: `Layout item "${item.i}" has no matching widget`,
            path: ["layouts", breakpoint, index, "i"],
          });
        }
      });
    }
  });
export type DashboardDoc = z.infer<typeof DashboardDocSchema>;

export const EMPTY_DASHBOARD: DashboardDoc = {
  widgets: [],
  layouts: { lg: [], md: [], sm: [] },
};
