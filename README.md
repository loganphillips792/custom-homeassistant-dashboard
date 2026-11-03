# custom-homeassistant-dashboard

A wall-tablet dashboard for Home Assistant. The server holds one connection to Home Assistant and relays entity changes to the browser, so the access token never reaches the tablet. Layouts are edited on the dashboard itself and saved in SQLite.

| Folder | Contents |
|-|-|
| `web/` | Vite and React app: grid, edit mode, widget host |
| `server/` | Hono server: Home Assistant connection, event stream, API |
| `shared/` | Types and Zod schemas used by both sides |
| `widgets/` | One folder per widget |
| `dev/` | Setup for the demo Home Assistant in `compose.yml` |
| `mosquitto/`, `themes/` | Config mounted into Mosquitto and Home Assistant |

## Run it in development

These steps run the app on your machine against a disposable demo Home Assistant, for working on the code. To run the real stack, see [Run everything in Docker](#run-everything-in-docker).

You need Docker, and Node 22 from `.nvmrc`.

```bash
nvm install
```

```bash
corepack enable
```

```bash
pnpm install
```

Start the demo Home Assistant on port 8124, with disposable lights, switches and sensors:

```bash
docker compose --profile demo up -d ha-demo
```

Complete its onboarding and write a token to the gitignored `.env`. The test login is in there too, if you want to open Home Assistant itself:

```bash
pnpm ha:setup
```

Start the server and Vite, then open http://localhost:5173:

```bash
pnpm dev
```

To use your real Home Assistant instead, set `HA_URL` and `HA_TOKEN` in `.env` and skip the demo steps. Prefer a non-admin user's token.

To delete the demo Home Assistant and the Docker dashboard's saved layouts, leaving your data in `~/docker-volumes/homeassistant/` alone:

```bash
docker compose --profile demo down -v
```

## Commands

| Command | What it does |
|-|-|
| `pnpm dev` | Runs the server and Vite, which proxies `/api` to the server |
| `pnpm test` | Runs the tests |
| `pnpm typecheck` | Typechecks every workspace |
| `pnpm lint` | Runs ESLint |
| `pnpm build` | Builds the front end into `web/dist` |
| `pnpm start` | Runs the server, which also serves `web/dist` |
| `pnpm ha:setup` | Prepares the demo Home Assistant. Safe to re-run |

## Run everything in Docker

This one command runs the whole stack:

```bash
docker compose up -d --build
```

| Service | Address |
|-|-|
| Dashboard | http://localhost:3000 |
| Home Assistant | http://localhost:8123 |
| Zigbee2MQTT | http://localhost:8095 |
| Mosquitto | `localhost:1883` |

To stop it and keep your data:

```bash
docker compose down
```

### Before the first run

1. Copy `.env.example` to `.env` and fill in the values under `docker compose up`.
2. Stop the homelab repo's Home Assistant stack, if it's running. Both stacks use the data in `~/docker-volumes/homeassistant/`, and their ports collide.
3. Run the command above, then create a long-lived token in Home Assistant, under your profile's Security tab.
4. Set the token as `DASHBOARD_HA_TOKEN` in `.env`, then run the command again.

Until step 4, the dashboard loads and shows that Home Assistant isn't connected. Zigbee2MQTT can't reach its coordinator until `SLZB_HOST` is set.

The dashboard's layouts are stored separately from `pnpm dev`, so tiles saved in one don't appear in the other.

## Add a widget

Add a folder under `widgets/`. There's no registration step, and the folder name is the widget's type.

`settings.ts` describes the widget and builds its settings panel. Keep this file free of React.

```ts
import { z } from "zod";
import { defineWidget } from "@dashboard/shared";

export default defineWidget({
  title: "Clock",
  defaultSize: { w: 3, h: 2 },
  schema: z.object({
    timeZone: z.string().optional().meta({ title: "Time zone" }),
  }),
});
```

`Widget.tsx` draws it. Import what you need from the app through `@sdk`:

```tsx
import type { WidgetProps } from "@sdk";
import type definition from "./settings.ts";

export default function Clock({ settings }: WidgetProps<typeof definition>) {
  return <div>{new Date().toLocaleTimeString([], { timeZone: settings.timeZone })}</div>;
}
```

The panel supports strings, numbers, booleans and enums. Add `.meta({ control: "entity" })` to a string for the entity picker. See `widgets/entity/` for a full example.

## Security

There's no login, so this assumes a trusted LAN. Anyone who can reach the port can edit the layout and toggle lights, switches, input booleans and fans. Other service calls aren't exposed, and the server rejects cross-origin writes. Don't publish the port to the internet.
