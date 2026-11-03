// What widgets may import from the app, as "@sdk".
export { toggleEntity } from "../api.ts";
export { useConnection, useEntity } from "../entityStore.ts";
export { entityDomain, isToggleable } from "@dashboard/shared";
export type { HaEntity, WidgetProps } from "@dashboard/shared";
