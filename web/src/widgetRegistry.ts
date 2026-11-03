import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { WidgetDefinition } from "@dashboard/shared";

// Any props: each widget's settings were validated against its own schema by WidgetHost.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WidgetComponent = ComponentType<{ settings: any }>;

export interface RegisteredWidget {
  type: string;
  definition: WidgetDefinition;
  Component: LazyExoticComponent<WidgetComponent>;
}

const definitions = import.meta.glob<{ default: WidgetDefinition }>(
  "../../widgets/*/settings.ts",
  { eager: true },
);
const components = import.meta.glob<{ default: WidgetComponent }>("../../widgets/*/Widget.tsx");

function folderName(path: string): string {
  return path.split("/").at(-2) ?? path;
}

const registry = new Map<string, RegisteredWidget>();
for (const [path, module] of Object.entries(definitions)) {
  const loader = components[path.replace(/settings\.ts$/, "Widget.tsx")];
  if (!loader) {
    console.error(`${path} has no Widget.tsx beside it, so it was skipped.`);
    continue;
  }
  const type = folderName(path);
  registry.set(type, { type, definition: module.default, Component: lazy(loader) });
}

export const widgetTypes: RegisteredWidget[] = [...registry.values()];

export function getWidget(type: string): RegisteredWidget | undefined {
  return registry.get(type);
}
