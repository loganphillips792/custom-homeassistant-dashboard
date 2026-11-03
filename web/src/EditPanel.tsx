import { useMemo, useState } from "react";
import type { HaEntity, WidgetDefinition, WidgetInstance } from "@dashboard/shared";
import { useEntities } from "./entityStore.ts";
import { fieldsFromSchema, type SettingsField } from "./settingsFields.ts";

const MAX_PICKER_RESULTS = 50;

function friendlyName(entity: HaEntity): string {
  const name = entity.attributes.friendly_name;
  return typeof name === "string" ? name : entity.entity_id;
}

function EntityPicker(props: { value: unknown; onChange: (id: string) => void }) {
  const { value, onChange } = props;
  const entities = useEntities();
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entities
      .filter(
        (entity) =>
          entity.entity_id.includes(needle) || friendlyName(entity).toLowerCase().includes(needle),
      )
      .sort((a, b) => friendlyName(a).localeCompare(friendlyName(b)))
      .slice(0, MAX_PICKER_RESULTS);
  }, [entities, search]);

  return (
    <div className="picker">
      <input
        type="search"
        placeholder="Search entities"
        aria-label="Search entities"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="picker-list" role="listbox" aria-label="Entities">
        {matches.map((entity) => (
          <button
            key={entity.entity_id}
            type="button"
            role="option"
            aria-selected={entity.entity_id === value}
            onClick={() => onChange(entity.entity_id)}
          >
            <span>{friendlyName(entity)}</span>
            <small>{entity.entity_id}</small>
          </button>
        ))}
        {matches.length === 0 && <p className="hint">No matching entities.</p>}
      </div>
    </div>
  );
}

function FieldControl(props: {
  field: SettingsField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { field, value, onChange } = props;
  switch (field.kind) {
    case "entity":
      return <EntityPicker value={value} onChange={onChange} />;
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case "enum":
      return (
        <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {!field.required && <option value="">None</option>}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          step={field.integer ? 1 : "any"}
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)
          }
        />
      );
    case "text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        />
      );
  }
}

/**
 * Valid values go straight into the draft, so the tile previews them. Invalid ones stay in the
 * form with an error, and closing the panel discards them.
 */
export function EditPanel(props: {
  widget: WidgetInstance;
  definition: WidgetDefinition;
  onChange: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { widget, definition, onChange, onClose } = props;
  const fields = useMemo(() => fieldsFromSchema(definition.schema), [definition]);
  const [values, setValues] = useState(widget.settings);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: string, value: unknown) => {
    const next = { ...values };
    if (value === undefined) delete next[key];
    else next[key] = value;
    setValues(next);

    const result = definition.schema.safeParse(next);
    if (result.success) {
      setErrors({});
      onChange(result.data);
      return;
    }
    const issue = result.error.issues.find((candidate) => candidate.path[0] === key);
    setErrors((current) => {
      const updated = { ...current };
      if (issue) updated[key] = issue.message;
      else delete updated[key];
      return updated;
    });
  };

  return (
    <aside className="panel" aria-label={`${definition.title} settings`}>
      <header>
        <h2>{definition.title}</h2>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </header>
      {fields.map((field) => {
        const error = errors[field.key];
        // A label may only wrap one control, and the entity picker has several.
        const Wrapper = field.kind === "entity" ? "div" : "label";
        return (
          <Wrapper key={field.key} className="field">
            <span className="field-title">{field.title}</span>
            {field.description && <span className="hint">{field.description}</span>}
            <FieldControl
              field={field}
              value={values[field.key]}
              onChange={(value) => setField(field.key, value)}
            />
            {error && <span className="field-error">{error}</span>}
          </Wrapper>
        );
      })}
    </aside>
  );
}
