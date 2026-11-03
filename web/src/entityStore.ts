import { useSyncExternalStore } from "react";
import type { EntityMap, HaEntity, ServerEvents } from "@dashboard/shared";

const RECONNECT_DELAY_MS = 3_000;

export interface ConnectionState {
  /** The event stream to this app's server is open. */
  stream: boolean;
  /** The server last reported that it's connected to Home Assistant. */
  homeAssistant: boolean;
  /** At least one entity has arrived, so a missing entity really is missing. */
  loaded: boolean;
}

type Listener = () => void;

const entities = new Map<string, HaEntity>();
const entityListeners = new Map<string, Set<Listener>>();
const listListeners = new Set<Listener>();
const connectionListeners = new Set<Listener>();
let entityList: HaEntity[] = [];
let connection: ConnectionState = { stream: false, homeAssistant: false, loaded: false };

function notify(listeners: Iterable<Listener> | undefined) {
  if (listeners) for (const listener of listeners) listener();
}

function setConnection(patch: Partial<ConnectionState>) {
  connection = { ...connection, ...patch };
  notify(connectionListeners);
}

function apply(changed: EntityMap, removed: string[]) {
  const affected: string[] = [];
  for (const [id, entity] of Object.entries(changed)) {
    if (entities.get(id)?.last_updated === entity.last_updated) continue;
    entities.set(id, entity);
    affected.push(id);
  }
  for (const id of removed) {
    if (entities.delete(id)) affected.push(id);
  }
  if (affected.length === 0) return;

  entityList = [...entities.values()];
  for (const id of affected) notify(entityListeners.get(id));
  notify(listListeners);
}

function applySnapshot(snapshot: EntityMap) {
  // A snapshot follows every reconnect, and entities may have gone away in the meantime.
  apply(snapshot, [...entities.keys()].filter((id) => !(id in snapshot)));
  if (entities.size > 0 && !connection.loaded) setConnection({ loaded: true });
}

/** Opens the event stream and returns a function that closes it. */
export function connectEntityStream(): () => void {
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const listen = <Name extends keyof ServerEvents>(
    target: EventSource,
    name: Name,
    handler: (data: ServerEvents[Name]) => void,
  ) => {
    target.addEventListener(name, (event) => handler(JSON.parse(event.data)));
  };

  const open = () => {
    const current = new EventSource("/api/events");
    source = current;
    current.onopen = () => setConnection({ stream: true });
    current.onerror = () => {
      setConnection({ stream: false });
      // Browsers retry a dropped connection, but give up for good on an error response,
      // such as a reverse proxy's 502 while this server restarts.
      if (current.readyState === EventSource.CLOSED) retry = setTimeout(open, RECONNECT_DELAY_MS);
    };
    listen(current, "snapshot", applySnapshot);
    listen(current, "changes", ({ changed, removed }) => {
      apply(changed, removed);
      if (entities.size > 0 && !connection.loaded) setConnection({ loaded: true });
    });
    listen(current, "status", ({ connected }) => setConnection({ homeAssistant: connected }));
  };
  open();

  return () => {
    clearTimeout(retry);
    source?.close();
    setConnection({ stream: false });
  };
}

function subscribeToEntity(id: string, listener: Listener): () => void {
  let listeners = entityListeners.get(id);
  if (!listeners) entityListeners.set(id, (listeners = new Set()));
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) entityListeners.delete(id);
  };
}

/** Re-renders only when this entity changes. */
export function useEntity(id: string): HaEntity | undefined {
  return useSyncExternalStore(
    (listener) => subscribeToEntity(id, listener),
    () => entities.get(id),
  );
}

/** Every entity. Re-renders on any change, so use it only where that's needed. */
export function useEntities(): HaEntity[] {
  return useSyncExternalStore(
    (listener) => {
      listListeners.add(listener);
      return () => listListeners.delete(listener);
    },
    () => entityList,
  );
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    (listener) => {
      connectionListeners.add(listener);
      return () => connectionListeners.delete(listener);
    },
    () => connection,
  );
}
