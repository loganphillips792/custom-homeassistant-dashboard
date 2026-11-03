import { useState, type CSSProperties } from "react";
import {
  isToggleable,
  toggleEntity,
  useConnection,
  useEntity,
  type HaEntity,
  type WidgetProps,
} from "@sdk";
import type definition from "./settings.ts";
import "./Widget.css";

const FULL_BRIGHTNESS = 255;
const DIMMEST_GLOW = 0.25;

function displayName(entity: HaEntity, label: string | undefined): string {
  if (label) return label;
  const name = entity.attributes.friendly_name;
  return typeof name === "string" ? name : entity.entity_id;
}

function displayState(entity: HaEntity): string {
  const unit = entity.attributes.unit_of_measurement;
  if (typeof unit === "string") return `${entity.state} ${unit}`;
  const words = entity.state.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How strongly a tile glows. Dimmed lights glow less, so the wall shows what's really on. */
function glowLevel(entity: HaEntity): number {
  if (entity.state !== "on") return 0;
  const { brightness } = entity.attributes;
  if (typeof brightness !== "number") return 1;
  return DIMMEST_GLOW + (1 - DIMMEST_GLOW) * (brightness / FULL_BRIGHTNESS);
}

export default function EntityWidget({ settings }: WidgetProps<typeof definition>) {
  const { entityId, label } = settings;
  const entity = useEntity(entityId);
  const { stream, homeAssistant, loaded } = useConnection();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!entity) {
    return (
      <div className="entity-tile" data-muted="">
        <span className="entity-name">{label ?? entityId}</span>
        <span className="entity-note">
          {loaded ? "Entity not found" : "Waiting for Home Assistant"}
        </span>
      </div>
    );
  }

  const live = stream && homeAssistant;
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";
  const level = glowLevel(entity);
  const style = { "--glow": level } as CSSProperties;
  const content = (
    <>
      <span className="entity-name">{displayName(entity, label)}</span>
      <span className="entity-state">{displayState(entity)}</span>
      {failed && <span className="entity-note entity-note-fault">Couldn't toggle</span>}
    </>
  );

  if (!isToggleable(entityId)) {
    return (
      <div className="entity-tile" data-muted={!live || unavailable ? "" : undefined} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="entity-tile"
      data-muted={!live || unavailable ? "" : undefined}
      style={style}
      aria-pressed={entity.state === "on"}
      disabled={!live || unavailable || busy}
      onClick={async () => {
        // The tile changes when Home Assistant reports the new state, not before.
        setBusy(true);
        setFailed(false);
        try {
          await toggleEntity(entityId);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {content}
    </button>
  );
}
