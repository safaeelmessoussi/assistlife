# AssistLife

One calendar for a Muslim's whole day — worship, health, work and family — with Hijri and Gregorian dates, built to be lived with the presence of Allah in everything. It later grows into a life assistant.

**Status:** version 1, steps 1 to 3 of 7 are built (calendar core; accounts, encrypted backup and Google Calendar; Islamic layer). Accounts and Google need the one-time [service setup](docs/SETUP.md). See the [product plan](docs/PLAN.md) and the [ideas list](docs/IDEAS.md).

## What works today

- Month, week and day views, in Arabic (default), French and English, right-to-left first.
- Hijri and Gregorian dates side by side everywhere, including the date picker.
- Hijri engine: astronomical estimate per region (Morocco by sighting, Mecca by calculation), published corrections, and a manual ±day adjustment.
- Events: timed, all-day and multi-day; repeating daily, weekly on chosen weekdays, monthly, yearly, and on Hijri months or years.
- Layers (calendars) with colours that can be shown, hidden, renamed, added and removed.
- Light and dark appearance; phone, tablet and desktop layouts.
- Everything is saved on the device and works offline.
- Optional account: end-to-end encrypted backup and sync between devices.
- Google Calendar inside the calendar: read, create, change and delete (browser only for now).
- Islamic layer: prayer times, fasting days and occasions with their sources, remembrance times, Friday items, events tied to a prayer, and a warning when an event covers a prayer's whole time.
- Optional cycle layer: import of a period tracker's backup, period days, expected periods and estimated fertile days.
- Android test app built automatically and offered for download from the settings.

## Run it

```bash
npm install
npm run web        # open in a browser
npm start          # then scan the QR code with Expo Go on a phone
```

## Check it

```bash
npm test           # unit tests: dates, Hijri engine, repeating events
npm run typecheck
npm run lint
npm run build:web  # static site in dist/
```

## Layout

| Path | Contents |
|---|---|
| `src/app/` | Screens: calendar, event form, settings |
| `src/components/` | Month grid, hour grid, day panel, pickers, shared controls |
| `src/lib/` | Pure logic with no interface code: dates, Hijri engine, events |
| `src/store/` | App state saved on the device |
| `src/sync/` | Account, encrypted backup and sync |
| `src/google/` | Google Calendar sign-in and event copy |
| `supabase/` | Database setup for the account server |
| `src/i18n/` | Interface texts and month and weekday names |
| `src/theme.ts` | Colours, fonts and spacing |
