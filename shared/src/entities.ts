export interface HaEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export type EntityMap = Record<string, HaEntity>;

/** Payloads of the events sent by `GET /api/events`, keyed by event name. */
export interface ServerEvents {
  snapshot: EntityMap;
  changes: { changed: EntityMap; removed: string[] };
  status: { connected: boolean };
}

/** Domains a tile may toggle. The server rejects toggles for anything else. */
export const TOGGLEABLE_DOMAINS: readonly string[] = ["light", "switch", "input_boolean", "fan"];

export function entityDomain(entityId: string): string {
  return entityId.split(".", 1)[0] ?? "";
}

export function isToggleable(entityId: string): boolean {
  return TOGGLEABLE_DOMAINS.includes(entityDomain(entityId));
}
