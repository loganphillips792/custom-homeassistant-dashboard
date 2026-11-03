import { useConnection, useEntity, type WidgetProps } from "@sdk";
import type definition from "./settings.ts";
import { readWordCard } from "./wordCard.ts";
import "./Widget.css";

export default function WordWidget({ settings }: WidgetProps<typeof definition>) {
  const wordEntity = useEntity(settings.wordEntity);
  const definitionEntity = useEntity(settings.definitionEntity);
  const { stream, homeAssistant, loaded } = useConnection();

  if (!wordEntity) {
    return (
      <div className="word-tile" data-muted="">
        <p className="word-text">
          {loaded ? `${settings.wordEntity} not found` : "Waiting for Home Assistant"}
        </p>
      </div>
    );
  }

  const card = readWordCard(wordEntity, definitionEntity);
  return (
    <div className="word-tile" data-muted={stream && homeAssistant ? undefined : ""}>
      <h2 className="word-title">{card.word ?? "No word yet"}</h2>
      {card.phonetic && <p className="word-phonetic">{card.phonetic}</p>}
      {card.partOfSpeech && <p className="word-part">{card.partOfSpeech}</p>}
      <p className="word-text">{card.definition ?? "No definition available"}</p>
    </div>
  );
}
