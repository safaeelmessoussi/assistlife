# AssistLife — Product Plan

> Working name: **AssistLife** (final name not chosen yet).
> Status: **version 1 in progress — step 1 (calendar core) built.** Each further step starts on the owner's go-ahead.
> New ideas go to [IDEAS.md](IDEAS.md) and are reviewed before each build step.

## 1. Vision

**Allah, our Creator, is with us anytime, anywhere.** The app helps a Muslim live every part of the day — worship, health, work, family, rest — feeling His presence and love. This is *ihsan*: «أن تعبد الله كأنك تراه» (hadith of Jibril, Sahih Muslim).

One calendar replaces the several calendars a person juggles (general calendar, period tracker, class schedule, fasting days, athkar reminders). It later grows into a life assistant that suggests beneficial things for free time.

### Product goals

1. **One calendar for everything**, with Hijri and Gregorian dates side by side.
2. **Less screen time**: short, satisfying sessions; the urge to open, never the pressure to stay.
3. **Printable**: paper can replace the phone for a day, a week or a month.
4. **Real-life goals reached**: the app acts as a gentle coach for plans, health and worship.
5. **Useful and trustworthy for all Muslims**, so that it can be sold.

Success is measured by plans kept and daily return, **not** by time spent in the app.

## 2. The voice of the app (first design rule)

Every action is an intention, a use of means, and a moment of remembering Allah. This rule sits above every feature.

- **Every reminder has three parts**: the action, the intention behind it, and a short dua.
  - Pill: «خذ دواءك أخذًا بالأسباب، والشافي هو الله» with «اللهم رب الناس أذهب البأس، اشفِ أنت الشافي».
  - Sport: «جسدك أمانة من الله» with «إن لجسدك عليك حقًا». We exercise to care for Allah's trust, not to look good.
- **Each kind of activity carries its intention**:

  | Activity | Intention |
  |---|---|
  | Work | Halal provision |
  | Sleep | Strength for worship |
  | Meals | Bismillah and gratitude |
  | Calling family | Keeping family ties (صلة الرحم) |
  | Study | Seeking knowledge |
  | Medication | Using the means; healing is from Allah |
  | Sport | Caring for the body as a trust (أمانة) |

  Events imported from outside sources get a light version, based on their category.
- **Begin and finish with Allah**: «بسم الله» at the start, «الحمد لله» on completion. Celebrations thank Allah instead of praising the user.
- **Future plans say «إن شاء الله»**. A missed task is met with mercy and a fresh start, never guilt.
- **Motivation rests on** «أحب الأعمال إلى الله أدومها وإن قلّ»: small and steady. Streaks and the garden reward constancy, not volume.
- **No showing off**: worship stays private. No leaderboards, no sharing of prayer or fasting statistics.
- **Evening review is *muhasaba***: gratitude for what went well, istighfar for what to repair, intention for tomorrow.
- **Hardship has its own voice**: illness, period days and missed goals get words of patience and reward.
- **Free time is a chance for something beneficial**, never something to "kill".

### Content rules

- Every ayah, hadith and dua is stored with its **source and authenticity grade**.
- All religious content is **reviewed by a qualified scholar before public release**; until then each text is marked "pending review".
- **Rulings are settings, not verdicts**: where schools differ, the user chooses (Maliki default for Morocco). The app does not issue fatwas.
- **Gendered Arabic**: onboarding asks once how to address the user; all texts follow.
- **Rotating wording**: several phrasings per reminder, so the words stay alive.
- **Tone setting**: full (intention and dua) or brief, so the app is never preachy and works in public.

## 3. Audience and languages

- **All Muslims.** The cycle layer is optional and off unless enabled.
- **Arabic is the default language**, right-to-left first. French and English follow in version 1; Turkish, Urdu, Indonesian and Malay at store launch.
- Full accessibility: large text, high contrast, screen reader support, spoken reminders.

## 4. Engagement principles

| We do | We do not |
|---|---|
| A fresh daily card (ayah, hadith, dua, tip) at each day's first open | Endless feeds |
| A two-minute morning brief and evening review, then a "you're done for today" screen | Tricks that keep the user scrolling |
| Widget and notification buttons ("taken", "prayed") so the app rarely needs opening | Notifications whose only purpose is to pull the user back |
| Forgiving streaks: period, illness and travel pause a streak instead of breaking it | Shame, guilt or loss-based pressure |
| A garden that grows with kept plans | Public rankings or comparison with others |
| Tiny first steps ("after Fajr, five minutes") and a weekly review | Overwhelming goal lists |

## 5. Features

### 5.1 Calendar core

- Month view (main view), week view, day view and agenda.
- **Dual dates** in every cell: Hijri and Gregorian.
- **Layers**: each source or topic is a colour-coded layer that can be shown or hidden.
- Create, edit and repeat events; categories carry an intention (section 2).
- **Hijri recurring events**: yearly events on Hijri dates (zakat due date, occasions).
- **Prayer-anchored events**: "after Asr", "30 minutes before Maghrib" — they move as prayer times shift through the year.
- **Prayer conflict detection**: an event covering a whole prayer window is flagged, with a suggested slot to pray.
- Search and filters.

### 5.2 Hijri engine (built from scratch)

- Calculated calendar as the base.
- **Per-country moon-sighting corrections** published by us each month (Morocco first).
- Manual ±1 day setting for the user.
- Reminder on the 29th that the new month may start.

### 5.3 Event sources

One connector system; each source becomes a layer.

| Source | Direction | Notes |
|---|---|---|
| Google Calendar | Two-way | Version 1 |
| Calendar links (ICS) | Read | Any public or private calendar link |
| Outlook / Microsoft | Two-way | Later phase |
| Bodour Al Amal | Read, events only | Through that platform's existing calendar API; no shared design or logic |
| Period tracker backup | One-time import | See 5.6 |

### 5.4 Islamic layer

- **Prayer times** by location, with calculation method and school settings; adhan and pre-prayer alerts.
- **Fasting days**: Ramadan, Mondays and Thursdays, white days (13–15), Arafah, Ashura with the day before, six of Shawwal, Sha'ban.
- **Athkar**: morning, evening, after prayer, sleep; tasbih counter.
- **Friday mode**: Al-Kahf, ghusl, the hour of dua before Maghrib.
- **Ramadan mode**: suhoor and iftar, tarawih, Quran completion plan, last ten nights, zakat al-fitr.
- **Seasons**: first ten of Dhul Hijjah, Udhiya, Hajj and Umrah planner.
- **Quran**: daily reading plan; memorisation revision schedule with spaced reviews.
- **Make-up tracker**: missed fasts (period, travel, illness) and missed prayers, with a plan to finish before next Ramadan.
- **Zakat**: Hijri anniversary reminder; sadaqah habit.
- **Extras**: qibla, last third of the night, Duha window, auto-silence during prayer.
- **Travel mode**: prayer times follow the traveller; shortened-prayer reminders; fasting exemption logged to the make-up tracker.

### 5.5 Health layer

- **Medications**: pills, eye drops and others; dose times, "taken" check-off, refill reminders.
- **Sport and training** sessions.
- **Diet**: meal plans, water.
- **Appointments**.
- **Sleep**: bedtime suggested from tomorrow's Fajr.
- **Fasting-aware**: on fasting days, dose and meal reminders move to between Maghrib and Fajr, with a "confirm with your doctor" note.
- All health reminders use the voice in section 2.

### 5.6 Cycle layer (optional)

- Period and fertility prediction from history.
- **Cycle-aware worship**: pauses prayer and fasting reminders, suggests dhikr and dua instead, feeds the make-up tracker.
- Postpartum mode.
- Discreet mode: hide the layer on shared screens and prints.
- **Import from "My Calendar" (Period Calendar) backup** — format verified on a real backup:
  - `.pc` file = Java object-stream wrapper (magic `AC ED 00 05`, block-data records) around a zip archive.
  - The zip contains `cloud.db`, a plain SQLite database.
  - Table `Period`: `date` (integer `YYYYMMDD`, period start), `period` (length value), `cycle` (cycle length in days); also `Note` and `Pill` tables.
  - To verify at build time: `period` appears to count days after the first, with a negative value meaning "predicted, not confirmed".
  - Import runs on the device only; the file is never uploaded.
- Importers for other trackers (Flo, Clue) later.

### 5.7 Print

- **Day, week and month views**, each exported as a PDF.
- The app measures the content and picks the **smallest paper size (A4 → A1) where nothing is cut or shrunk below a readable size**.
- **Large-print mode** for vision issues goes one size up.
- **Tick boxes** for prayers, medications and athkar.
- Choice of layers to print; ink-saving black-and-white option.
- **Poster mode**: splits A2/A1 across A4 sheets for home printers.

### 5.8 Today screen and coach

- Today: next prayer, today's plan, daily card.
- Morning brief and evening *muhasaba*.
- Forgiving streaks, the garden, weekly review.
- Home-screen widget; actionable notifications; spoken reminders.
- Voice entry in Arabic («درس كل ثلاثاء بعد العصر»).

### 5.9 Family and life

- **Family ties**: people with a check-in rhythm, Eid greetings list, visiting the sick.
- **Shared family calendar** with control over what each person sees.
- Printable prayer chart for children.

### 5.10 Life assistant (later)

- Detects free time slots.
- Suggests from the user's own lists: hobbies, calls to relatives, an article on a new subject, a walk.
- Learns which suggestions are accepted.

## 6. Technical foundations

These are expensive to change later and are considered settled.

| Area | Decision |
|---|---|
| App | React Native with Expo, TypeScript — one codebase for Android, iPhone and browser (phone, tablet, desktop) |
| Data | Offline-first: local database on the device, background sync |
| Reminders | Scheduled on the device, so prayer and medication alerts fire without internet |
| Accounts | Optional: the app works without one; an account adds sync and encrypted backup |
| Server | Managed Postgres with authentication (Supabase to start, EU region) plus background workers for calendar sync |
| Health data | Cycle and medication data encrypted on the device with a key the server never sees |
| App security | App lock with biometrics; data export; account deletion |
| Privacy | No ads, no selling of data; compliance with Moroccan law 09-08 and GDPR |
| Quality | Automated tests, crash reporting, staged releases |
| Layout | Right-to-left first; responsive from phone to desktop |

Known risks to handle during the build:

- **Android battery saving** (Samsung in particular) can delay reminders; exact alarms and user guidance are needed.
- **Google sign-in verification**: calendar access needs Google's review before public launch; before that, only listed test users can connect.
- **iPhone outside the App Store**: only the browser version ("Add to Home Screen") until an Apple developer account exists; reminders are less reliable there.

## 7. Distribution

- **Test release**: browser version on a free `pages.dev` address, with a download button for the Android app file (hosted on GitHub Releases). This is for testing only.
- **Production**: own domain, Google Play and App Store, production hosting with monitoring and backups.

## 8. Roadmap

### Version 1 — test release

Delivered in testable steps:

1. **Calendar core**: month, week and day views, dual dates, Hijri engine, layers, events, Arabic first. ✅ Built — see the notes below.
2. **Google Calendar sync** and accounts with encrypted backup. 🔶 Built and tested against simulated servers; waiting for the real services — see the notes below.
3. **Islamic layer**: prayer times, fasting days, athkar, Friday mode, prayer-anchored events and conflicts. ✅ Built — see the notes below.
4. **Health layer**: medications, sport, diet, appointments, fasting-aware reminders.
5. **Today screen** with the daily card and the voice of the app.
6. **Print**: day, week and month with automatic paper size.
7. **Test release**: browser version and Android download.

#### Step 1 notes

- **Verified**: unit tests for dates, the Hijri engine and repeating events; the screens were exercised in a browser at phone, tablet and desktop sizes. **Not yet run on a physical phone.**
- **Hijri engine check**: the Morocco estimate reproduces the announced starts of Ramadan 1446, Shawwal 1446, Dhul Hijjah 1446, Muharram 1447 and Ramadan 1447; the Mecca estimate reproduces the calculated calendar for the same period.
- **Storage** is a simple on-device store behind one module (`src/store`). It is replaced by a synced database in step 2 without changing the screens.
- **Not in step 1**: changing or deleting a single occurrence of a repeating event (edits apply to the whole series); "every 2 weeks"-style intervals in the form (the engine supports them); corrections delivered from the server (they are bundled for now).

#### Step 2 notes

- **Accounts are optional.** Signing in uses e-mail and one password. The password is stretched on the device into two secrets: one signs in, the other encrypts. The server never receives the password or the encryption key, so the whole backup (not only health data) is unreadable to it. The price: a forgotten password cannot open the backup; the data on the device is unaffected.
- **Backup and sync**: one encrypted document per account with a revision number. Devices merge record by record (newest change wins, deletions are remembered) and never overwrite each other blindly. Sync runs at launch, a few seconds after a change, when the app returns to the front, and on demand.
- **Google Calendar is two-way** and runs entirely in the browser: events can be created, changed and deleted in calendars the user may write to (one occurrence at a time for Google's repeating events; calendars shared read-only stay read-only). Google gives the browser a one-hour access token, which is kept in memory only. No Google credential reaches our server, so no server workers are needed (a change from the original plan, for privacy and simplicity). Repeating events arrive already expanded by Google. The copy of the Google events, the connected account's address and the choice of shown calendars travel in the encrypted backup, so every device shows the same calendar even if it never connected to Google itself; it is as fresh as the last refresh on any device.
- **Limits to lift later**: changing a whole Google repeating series from the app; moving an event between a Google calendar and an own calendar; refreshing Google without a tap after the hour (needs the phone app's sign-in, which comes with the Android build in step 7); Google sign-in inside the phone app; changing the account password; deleting the account from inside the app.
- **Verified**: unit tests for encryption, merging, the sync round and Google's event format; a two-device browser test against simulated account and Google servers. **Not yet verified against the real Supabase and Google services** — that needs the setup in [SETUP.md](SETUP.md).

#### Step 3 notes

- **Prayer times** come from the `adhan` library (a vetted open-source implementation) rather than our own astronomy. The Moroccan method follows the Ministry of Habous settings (Fajr 19°, Isha 17°, its customary safety minutes); six other methods and the Hanafi Asr are settings. City list with search; no automatic location yet.
- **Fasting days and occasions** are computed from the Hijri date, never stored: Ramadan, Arafah and the days before it, Ashura with the day before, six of Shawwal, the white days, Mondays and Thursdays; the Hijri new year, the start of Ramadan, its last ten nights, the two Eids and the days of Tashriq. No fast is ever shown on a day when fasting is not allowed.
- **Remembrance and Friday**: morning, evening and bedtime remembrance tied to Fajr, Asr and Isha; Al-Kahf and the last hour before Maghrib on Fridays. They show in the day and week views and the day list, not in month cells.
- **Every such item opens an explanation** with its verse or hadith in Arabic and its source. All of this content is marked pending scholar review (`src/content/islamic.ts`).
- **Events tied to a prayer** ("15 minutes after Asr") move with the prayer through the year. **An event that covers a prayer's whole time** is flagged in the form and in the day list.
- **Alerts** work in a browser while the app is open. Alerts with the app closed need the phone app's scheduler: not built yet.
- **Not in step 3**: the texts of the remembrances themselves, qibla, Ramadan mode, the make-up tracker, Quran plans (all planned for later phases); events tied to a prayer inside Google calendars.

#### Android test app

- A GitHub workflow builds the Android app file from `main` on every change and publishes it as the `android-latest` release; the settings screen on the web has a download row.
- It is signed with the project template's test key: fine for testing, not for a store.
- **Not verified on a device from the development side.** Known gaps on the phone app: Google Calendar sign-in (browser only for now) and alerts.

### Phase 2 — cycle and make-up

**Brought forward (built):** the optional cycle layer — import of a "My Calendar" backup (read on the device, never uploaded), recording and deleting periods by hand, period days, the expected next periods and the estimated fertile days tinted on the month grid, the day of the cycle in the day list, sync in the encrypted backup, and no fasting suggestion on a recorded period day. Period length is read as the tracker's stored value plus one day, which reproduces the tracker's own display for the checked months.

**Still to build in this phase:** the make-up tracker (missed Ramadan days counted and planned), pausing prayer reminders with alternative worship suggestions, postpartum mode, discreet mode for shared screens and prints, import in the phone app, importers for other trackers.

Cycle layer, backup import, cycle-aware worship, make-up tracker.

### Phase 3 — sources and coach

Bodour Al Amal events, Outlook, calendar links; coach, garden, streaks, widgets, Ramadan mode, Quran plans.

### Phase 4 — assistant and family

Life assistant, family ties, shared family calendar, travel mode, voice entry.

### Phase 5 — store launch

Own domain, Play Store and App Store, scholar review complete, paid plan, more languages.

## 9. Business model (draft)

- **Free**: the core calendar, prayer times, fasting days, basic reminders.
- **Premium**: life assistant, unlimited sources, widgets, encrypted cloud backup, family plan.
- Never ads; never selling data.

## 10. Open items

- Final app name.
- Scholar or reviewing body for religious content.
- Exact split between free and premium.
