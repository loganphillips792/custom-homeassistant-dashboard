import type { EntityMap, ServerEvents } from "@dashboard/shared";

export type HubEvent = {
  [Name in keyof ServerEvents]: { event: Name; data: ServerEvents[Name] };
}[keyof ServerEvents];

type Listener = (event: HubEvent) => void;

/** Holds the latest copy of every entity and relays what changes to connected clients. */
export class EntityHub {
  private entities: EntityMap = {};
  private connected = false;
  private readonly listeners = new Set<Listener>();

  get clientCount(): number {
    return this.listeners.size;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  has(entityId: string): boolean {
    return entityId in this.entities;
  }

  /** The events a new client needs first. */
  initialEvents(): HubEvent[] {
    return [
      { event: "snapshot", data: this.entities },
      { event: "status", data: { connected: this.connected } },
    ];
  }

  /**
   * Accepts the full map from `subscribeEntities`. The library replaces the object of each
   * entity that changes and reuses the rest, so comparing references finds the changes.
   */
  update(next: EntityMap): void {
    const changed: EntityMap = {};
    for (const [id, entity] of Object.entries(next)) {
      if (this.entities[id] !== entity) changed[id] = entity;
    }
    const removed = Object.keys(this.entities).filter((id) => !(id in next));
    this.entities = next;

    if (Object.keys(changed).length > 0 || removed.length > 0) {
      this.emit({ event: "changes", data: { changed, removed } });
    }
  }

  setConnected(connected: boolean): void {
    if (connected === this.connected) return;
    this.connected = connected;
    this.emit({ event: "status", data: { connected } });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: HubEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
