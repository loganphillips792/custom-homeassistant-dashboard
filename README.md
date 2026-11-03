# custom-homeassistant-dashboard

A wall-tablet dashboard for Home Assistant. The server holds one connection to Home Assistant and relays entity changes to the browser, so the access token never reaches the tablet. Layouts are edited on the dashboard itself and saved in SQLite.

| Folder | Contents |
|-|-|
| `web/` | Vite and React app: grid, edit mode, widget host |
| `server/` | Hono server: Home Assistant connection, event stream, API |
| `shared/` | Types and Zod schemas used by both sides |
| `widgets/` | One folder per widget |
| `dev/` | Setup for the throwaway Home Assistant in `compose.yml` |

## Run it in development

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

Start a throwaway Home Assistant on port 8124, with demo lights, switches and sensors:

```bash
docker compose up -d homeassistant
```

Complete its onboarding and write a token to the gitignored `.env`. The test login is in there too, if you want to open Home Assistant itself:

```bash
pnpm ha:setup
```

Start the server and Vite, then open http://localhost:5173:

```bash
pnpm dev
```

To use a real Home Assistant instead, set `HA_URL` and `HA_TOKEN` in `.env` and skip the Docker steps. Prefer a non-admin user's token.

## Commands

| Command | What it does |
|-|-|
| `pnpm dev` | Runs the server and Vite, which proxies `/api` to the server |
| `pnpm test` | Runs the tests |
| `pnpm typecheck` | Typechecks every workspace |
| `pnpm lint` | Runs ESLint |
| `pnpm build` | Builds the front end into `web/dist` |
| `pnpm start` | Runs the server, which also serves `web/dist` |
| `pnpm ha:setup` | Prepares the development Home Assistant. Safe to re-run |

## Run the container

The app and API share one port, which is what Fully Kiosk points at.

```bash
docker compose --profile app up -d --build
```

Then open http://localhost:3000. To deploy against a real Home Assistant, build the image and run it with `HA_URL`, `HA_TOKEN` and a volume at `/data`, which holds the layouts:

```bash
docker build -t ha-dashboard .
```

To delete the development Home Assistant and the saved layouts:

```bash
docker compose --profile app down -v
```

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
