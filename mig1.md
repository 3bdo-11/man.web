# MAN – Muslim Accountability Tracker: Native Android Migration Specification

> **Source project:** React 19 + TypeScript + Vite + Capacitor 8
> **Target:** Kotlin 2.0+ / Jetpack Compose, no WebView, no Capacitor
> **Author:** Abdel-Rahman
> **Date:** 2026-06-19

---

## 1. App Summary

**Core objective:** A fully-offline, private behavioral tracking app that helps Muslim users build discipline through daily logging of prayers (Salah), addiction-relapse events, physical training, weight, and screen time. The app computes a composite daily score (0–100) and provides analytics to identify patterns.

**Accountability philosophy:** The app enforces self-accountability through:
- **Real-time scoring** — every logged action immediately adjusts a daily score
- **Auto-miss detection** — prayers not logged within their window are auto-marked missed
- **Relapse penalties** — exceeding daily relapse targets reduces score steeply; clean days earn maximum points
- **Visual urgency** — active prayer windows show countdowns; missed prayers trigger notifications
- **No cloud, no sync** — all data stays on-device, reinforcing personal ownership

**Target behavior:** Users log daily: 5 prayers (Fajr, Dhuhr, Asr, Maghrib, Isha), relapse events (tapping a large counter button), training type (gym/fighting/cardio), weight (kg), and screen time (auto-tracked via UsageStats). The daily score provides immediate feedback; analytics reveal weekly/monthly/yearly trends.

---

## 2. Feature Breakdown

### 2.1 Prayer Tracking
- Display 5 mandatory prayer times computed from the adhan library (Cairo coordinates, Egyptian calculation method)
- Each prayer has a status: pending -> prayed | missed | qada
- Sunnah flag — optional toggle for prayed-before-sunnah on Fajr, Dhuhr, Maghrib, Isha
- On-time detection — within 30 minutes of adhan = on_time; after 30 min = late
- Auto-miss — if time window expires (e.g., Fajr → sunrise, Dhuhr → Asr), the prayer is auto-marked missed via an AlarmManager-triggered BroadcastReceiver at window end
- Qada — marking a missed prayer as made up later increments a qada counter
- Time editing — tap a logged prayer to edit its actual time; changes affect on_time recalc
- Urgency warning — when within 15 min of window expiry, shows a red banner
- Jumu'ah (Friday) replaces Dhuhr label

### 2.2 Relapse Tracking
- Large tap-to-log button on a dark card; haptic feedback on tap
- Each relapse records a timestamp with auto-generated UUID
- Relapses are sortable (newest first), editable (time), deletable (with confirmation timeout)
- Daily relapse count shown against configurable target (default 2)
- Clean days (0 relapses) show a star badge

### 2.3 Training Tracking
- Three training types: Gym, Fighting, Cardio (3-column grid)
- Toggle on/off per type; each type can be logged once per day
- Visual state: TRAINED (green) vs NOT DONE (ghost)
- Delete with double-tap confirmation (2.5s timeout)

### 2.4 Weight Tracking
- Simple +/- 0.5 kg stepper with immediate save (no debounce)
- Last known weight used as stepper seed when no current weight entered
- Saves as number (kg) per day

### 2.5 Screen Time Tracking (Android UsageStats)
- Queries UsageStatsManager for foreground time of all apps
- Excludes the app's own package name
- Returns per-app breakdown: packageName, appName, minutes
- Total is persisted per day: total_screen_minutes, app_usages[]
- Polls every 5 minutes while app is foregrounded; also refreshes on appStateChange resume
- Note: There is an ~15–30 minute delay before UsageStats query results stabilize. On first query after grant or after boot, data may return 0 or stale values. The native app should rely on INTERVAL_DAILY for stable daily aggregates and avoid displaying real-time results.
- Requires PACKAGE_USAGE_STATS permission
- Web fallback: returns 0 / empty when no permission or on non-native platforms

### 2.6 Notification System
- Prayer reminders — fired offset_minutes before each prayer time
- Missed prayer check — when next prayer time arrives, checks if current prayer was logged; if not, fires "Missed {prayer}!" notification
- Offset configurable (5/10/15/30 min)
- Cancel all on disable or timezone change
- Uses Capacitor LocalNotifications on native; falls back to Web Notification API

### 2.7 Scoring System (detailed in §5)
- Four weighted components: Prayer (max 50), Relapse (max 30), Training (max 15), Screen Time (max 5)
- Total clamped to [-100, 100]
- Pre-clamp component ranges:
  - Prayer:      [-50, +50]
  - Relapse:     [-60, +30]
  - Training:    [  0, +15]
  - Screen Time: [-30,  +5]
- Theoretical pre-clamp range: [-140, +100]
- Note: The maximum of +100 is achievable without clamping (perfect day). The minimum of -100 is a clamped floor; a worst-case day scores -140 before clamping. The clamp absorbs up to 40 penalty points on catastrophic days.
- Score interpretation: >=80 Excellent, >=50 Good, >=20 Average, >=0 Poor, <0 Critical

### 2.8 Settings
- Timing: Day boundary hour (0-6, default 3AM), First day of week (Sun-Sat)
- Targets: Relapse daily target (0-5, 0=off), Screen time target (30-240 min)
- Notifications: Enable/disable, reminder offset, permission state
- Permissions: Notification grant status, Usage Access grant status
- Data management: Export JSON, Import JSON (merge or replace), Export readable report, Reset all data



### 2.9 Analytics
- Period navigation: weekly / monthly / yearly with prev/next
- Score gauge — large ring chart with score value and interpretation
- Score breakdown — Prayer, Relapse, Training, Screen sub-scores
- Behavioral pattern — grouped score bars by day-of-week/week-of-month/month
- Relapse deep analysis:
  - Target progress bars (Today / Week / Month / Quarter / Year)
  - History heatmap (scrollable mini calendar grid, colored by relapse count)
  - Streak display (current best streak + top 10 streaks)
  - Frequency grid (relapse count by day-of-week x month)
- Prayer analytics — stat card showing prayer percentage adherence, strongest prayer (green), weakest prayer (red)
- Weight chart — line chart; delta vs previous period
- Screen time chart — line chart; top 3 apps breakdown
- 790-day lookback window

### 2.10 Data Persistence & Safety
- Primary store: IndexedDB via idb library
- Memory cache — reads served from in-memory map; writes queue per date key
- Write queue — sequential, batched per date key; mutation functions for atomic updates
- Legacy migration — from localStorage v1/v2 formats to IndexedDB
- Recovery backup — periodic snapshot to localStorage every 5 min + on data change (5s debounce)
  - Native: Room transaction listener writes to DataStore backup every 5 data writes aggregated with a 5-second debounce (no periodic timer)
- Integrity check — on startup, reports missing day gaps and expected vs actual day count

- Import/export — full JSON export (settings + all daily logs); import with merge or replace mode; validation on import


### 2.11 Onboarding
- Single-screen welcome with "Go to Home" button
- Sets onboarding_completed flag; suppresses main UI until done

---

## 3. Screen Map

### 3.1 Daily Tracking (/ — DailyTracking.tsx)
| Element | Description |
|---|---|
| Date navigator | Prev/next day arrows; shows "TODAY" or weekday name + formatted date |
| Day progress bar | 0-100% bar between boundary hours (e.g., 3AM-3AM) |
| Score display | Large number (0-100) + label + animated ring chart |
| Score breakdown | 4-column grid: Prayer, Training, Relapse, Screen sub-scores |
| Prayer section | 5-row list (Fajr -> Isha): status badge, time, tap to log; inline time editor with +/-5 min |
| Relapse section | Dark card with large tap counter; list of today's relapses with time + delete |
| Training section | 3-column grid: Gym / Fighting / Cardio icons; toggle per type |
| Weight section | +/- 0.5 kg stepper with immediate save |
| Screen time section | Ring chart vs target, top apps bar list |
| Navigation | Bottom tab bar: Daily / Analytics / Settings |

### 3.2 Analytics (/analytics — Analytics.tsx)
| Element | Description |
|---|---|
| Period navigation | Tab switcher (Weekly/Monthly/Yearly) + prev/next arrows + label |
| Summarize section | Large score gauge ring; KPI grid (Avg Score, Streak, Relapses, Prayer % etc.) |
| Behavioral pattern bar | Colored bars by weekday/week/month |
| Relapse deep analysis | Target cards, history heatmap, streak bars, frequency grid |
| Prayer stat card | Prayer adherence % with best/weakest prayer labels |
| Weight chart | Line chart with period-over-period delta |
| Screen time chart | Line chart + top 3 apps list |
| Empty state | "No data yet" with link to Daily tab |

### 3.3 Settings (/settings — Settings.tsx)
| Element | Description |
|---|---|
| App header | "SETTINGS" title + version + save status indicator |
| Timing Logic card | Day boundary hour toggle, First weekday toggle |
| Targets card | Relapse daily target toggle, Screen time target toggle |
| Permissions card | Notification permission (status + enable button), Usage Access permission (status + enable button), Reminder offset toggle |
| Scoring System card | 2x2 grid of component scores with visual bars + score range legend |
| Data card | Export JSON, Import JSON (drag/drop + file picker), Export readable report, Reset all data (with confirmation modal) |
| About section | Version, author credit |

### 3.4 Navigation Flow
```
App
 ├── Loading (init animation)
 ├── Onboarding (if !onboarding_completed)
 └── Main Shell
      ├── Header: "MAN." logo + save status indicator
      ├── Content
      │    ├── DailyTracking (/) — daily log + score
      │    ├── Analytics (/analytics) — period-based analytics
      │    └── Settings (/settings) — configuration + data management
      └── Bottom Tab Bar (Daily / Analytics / Settings)
```

---

## 4. Data Model

### 4.1 Entity: DayLog
The single aggregate root. Each date has exactly one DayLog document.

| Field | Type | Default | Description |
|---|---|---|---|
| dateStr | String (yyyy-MM-dd) | — | Primary key |
| total_screen_minutes | Int | 0 | Aggregated screen time in minutes |
| relapses | List[RelapseEvent] | [] | Relapse events for this day |
| prayers | Map[String, PrayerLog] | {} | Keyed by prayer name (fajr/dhuhr/asr/maghrib/isha) |
| trainings | List[TrainingLog] | [] | Training entries for this day |
| weight | Double? | null | Body weight in kg |
| qada_count | Int | 0 | Number of qada prayers made today |
| app_usages | List[AppUsage] | [] | Per-app screen time breakdown |
| updated_at | String (ISO 8601) | now | Last write timestamp |

### 4.2 Entity: PrayerLog
| Field | Type | Description |
|---|---|---|
| id | String (UUID) | Unique identifier |
| name | String (fajr/dhuhr/asr/maghrib/isha) | Which prayer |
| status | String (prayed/missed/pending/qada) | Current state |
| delay_minutes | Int | Minutes delayed |
| sunnah_flag | Boolean | Whether sunnah was performed |
| on_time | Boolean | Within 30 min of adhan |
| actual_time | String? | ISO timestamp of when logged |
| target_time | String? | ISO timestamp of adhan time |

### 4.3 Entity: RelapseEvent
| Field | Type | Description |
|---|---|---|
| id | String (UUID) | Unique identifier |
| timestamp | String (ISO 8601) | When the relapse occurred |
| edited_at | String? | Last edit timestamp |

### 4.4 Entity: TrainingLog
| Field | Type | Description |
|---|---|---|
| id | String (UUID) | Unique identifier |
| type | String (gym/fighting/cardio) | Training category |
| timestamp | String (ISO 8601) | When logged |
| note | String | Optional note (unused in web UI; display in native) |
| is_pr | Boolean? | Personal record flag (unused in web UI; add toggle in native) |
| pr_details | String? | PR description (unused in web UI; show in native) |

### 4.5 Entity: AppUsage
| Field | Type | Description |
|---|---|---|
| appName | String | Human-readable app name |
| minutes | Int | Foreground minutes in the period |
| packageName | String? | Android package identifier |

### 4.6 Entity: UserSettings (singleton)
| Field | Type | Default | Description |
|---|---|---|---|
| onboarding_completed | Boolean | false | Has completed onboarding |
| notifications_enabled | Boolean | true | Master notification toggle |
| prayer_reminder_offset | Int | 15 | Minutes before prayer to remind |
| day_boundary_hour | Int | 3 | Hour (0-23) for behavioral day rollover |
| relapse_daily_target | Int | 2 | Daily relapse target (0=off) |
| screen_time_target | Int | 60 | Daily screen time target in minutes |
| firstWeekday | Int | 6 | First day of week (0=Sun -> 6=Sat) |
| retention_months | Int | 0 | Data retention period in months (0 = unlimited) |

### 4.7 Relationships
- 1-to-1: One DayLog per calendar date (yyyy-MM-dd key)
- 1-to-many: DayLog -> RelapseEvent[], DayLog -> TrainingLog[], DayLog -> AppUsage[]
- 1-to-5: DayLog -> PrayerLog map (exactly 5 keys)
- Singleton: UserSettings stored separately
- No cross-day relationships — each day is independent

### 4.8 Time-Based Data Structure
- Key format: yyyy-MM-dd (derived from UTC date adjusted by the configurable boundary hour)
- Boundary logic: getBehavioralToday(hour=3) in src/lib/dateUtils.ts subtracts boundaryHour from current time, then takes startOfDay. E.g., at 2AM with boundary=3, the effective "today" is yesterday.
- Week range: startOfWeek(logicalDate, { weekStartsOn: firstWeekday })

---

## 5. Business Logic Rules

### 5.1 Scoring Algorithm (calculateDailyScore)

**Formula:** total = clamp(prayerScore + relapseScore + trainingScore + screenTimeScore, -100, 100)

#### Prayer Component (max 50)
| Status | On-time | Sunnah | Points |
|---|---|---|---|
| prayed | yes | yes | +10 |
| prayed | yes | no | +9 |
| prayed | no | — | +5 |
| qada | yes | — | +6 |
| qada | no | — | +3 |
| missed | — | — | -10 |

All 5 prayers summed: range [-50, +50]

#### Relapse Component (max 30, min -60)
```
if target <= 0 && actual == 0:  +30
if target <= 0 && actual > 0:   max(-60, -actual * 10)
if actual == 0:                 +30
if actual <= target:            round(30 * (1 - actual / target))
if actual > target:             max(-60, -(actual - target) * 10)
```

#### Training Component (max 15, min 0)
```
typeScore = 3 per unique type (gym/cardio/fighting)  -> max 9
bonus = min(extraSessions, 6)   // sessions beyond unique types
total = min(typeScore + bonus, 15)
```

#### Screen Time Component (max 5, min -30)
```
if actual <= target:        +5
if actual > target:         max(-30, -round(overMinutes / max(1, target) * 15))
```

### 5.2 Relapse Rules
- No daily cap on number of relapses that can be logged
- Score penalty is progressive: 0 relapses = +30; at or under target = scaled; over target = -10 per excess
- Clean streak computed from consecutive zero-relapse days
- Relapse events are timestamped with second precision, editable

### 5.3 Prayer Rules
- Auto-miss (Native Android): At prayer scheduling time, a single AlarmManager.setExactAndAllowWhileIdle() is set for the end of each prayer's time window (e.g., sunrise for Fajr, Asr adhan time for Dhuhr). When the alarm fires, a BroadcastReceiver checks if the prayer was logged; if not, it is auto-saved as missed. No polling loop is used. The 10-second ticker described in the web source is replaced entirely by this alarm-based mechanism.
- Isha has no window end in the web app (undefined end). The native app can schedule a pre-dawn alarm at Fajr-1min to auto-miss Isha after Fajr time begins.
- The 10-second ticker in the web app also drives visual UI state (countdown timers, "time remaining" labels, active/upcoming/missed transitions). In the native app, use a lightweight coroutine loop (`LaunchedEffect` + `delay(10_000)`) or a `Flow.interval` to periodically refresh these display-only states. This is separate from the auto-miss alarm mechanism.
- On-time window: 30 minutes from adhan; after 30 min, prayer is late (on_time=false)
- Qada is a separate status — can be assigned to any non-prayed, non-missed pending prayer
- Sunnah flag only applicable for: Fajr, Dhuhr, Maghrib, Isha (not Asr)
- On Friday, Dhuhr label changes to "JUMU'AH"

### 5.4 Training Rules
- Each type can be logged at most once per day (UI toggle on/off)
- Multiple sessions of the same type do not increase score beyond the type bonus
- Extra sessions beyond 3 unique types add bonus points (capped at 6)

### 5.5 Screen Time Rules
- Queried via UsageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
- Only foreground time counted; own package excluded
- Aggregated per day; refreshes every 5 min while app is open
- Each app's minutes are summed across all days in a period for top-apps analytics

### 5.6 Target System
- Relapse target default 2, range [0, 5]; 0 = no target (unlimited)
- Screen time target default 60 min, range [30, 240]
- Targets are evaluated daily; score formula uses them as thresholds
- Target progress bars in analytics show Today/Week/Month/Quarter/Year accumulation

### 5.7 Daily Reset & Carry-Over
- No carry-over between days — each day is independently scored
- Behavioral day boundary defaults to 3AM (configurable 0-6)
- At boundary hour, the day label flips to the next calendar date
- No data aggregation across boundaries within a day
- Day rollover triggers: compute tomorrow's prayer times, cancel today's AlarmManager alarms, schedule tomorrow's alarms (prayer reminders + auto-miss). Use BroadcastReceiver or WorkManager at boundary hour to execute reschedule.



---

## 6. Android Native Rewrite Plan

### 6.1 Architecture Overview

```
                             UI Layer (Compose)
  DailyScreen  AnalyticsScreen  SettingsScreen  Onboarding
                             |
                          ViewModels
  DailyViewModel  AnalyticsViewModel  SettingsViewModel
                             |
                    Domain / Repository Layer
  DayLogRepository  SettingsRepository  ScoreCalculator
                             |
                         Data Layer
  Room DB (DayLogDao, SettingsDao)  FileExport/Import
                             |
                 Android System Services
  UsageStatsManager  AlarmManager  NotificationManager
  AppOpsManager  PackageManager
```

### 6.2 Feature -> Component Mapping

| Current (Web/Capacitor) | Native Android Equivalent | Recommended Android Component |
|---|---|---|
| Prayer time calc (adhan library) | adhan-java (`com.batoulapps.adhan:adhan:2.0.0`) — locked library | PrayerTimeCalculator wrapping adhan-java |
| Offline DB (IndexedDB via idb) | Room database with DAOs | Room with DayLog entity, Settings singleton entity |
| Memory cache + write queue (StorageService) | Room handles this natively; use Flow for reactive reads | Room + kotlinx.coroutines.flow.Flow |
| Screen time (ScreenTimePlugin.java / UsageStatsManager) | Already native — reuse the existing Java code as a Kotlin repository | UsageStatsRepository (calls UsageStatsManager directly via coroutines) |
| Notifications (LocalNotifications Capacitor plugin) | NotificationManager + AlarmManager (exact alarms) | NotificationHelper + AlarmManager with SCHEDULE_EXACT_ALARM permission |
| Auto-miss prayer detection (JS setTimeout-based) | AlarmManager.setExactAndAllowWhileIdle() — one alarm per prayer window end | AlarmManager + BroadcastReceiver |
| Prayer reminder scheduling | AlarmManager firing BroadcastReceiver -> NotificationManager | AlarmManager + NotificationReceiver (BroadcastReceiver) + NotificationCompat.Builder |
| Missed prayer check (setTimeout) | AlarmManager at next prayer time | Same as above |
| Haptic feedback (Navigator.vibrate) | Vibrator / VibratorManager (API 31+) | HapticFeedback utility using View.performHapticFeedback() or VibrationEffect |
| Navigation (React Router) | Jetpack Compose Navigation | NavHost + NavController |
| Animations (Motion) | Compose animation APIs | animateContentSize(), AnimatedVisibility, animateXxxAsState |
| Bottom tab bar (custom) | NavigationBar (Material 3) | NavigationBar + NavigationBarItem |
| Charts (Recharts) | Compose Canvas / Vico library | Canvas or Vico (Compose charting library) |
| Date utilities (date-fns) | java.time / ThreeTen Backport | java.time.LocalDate, java.time.DayOfWeek, etc. |
| Export/Import (JSON Blob download) | FileProvider + Intent.ACTION_CREATE_DOCUMENT | ActivityResultContracts.CreateDocument + Kotlinx Serialization |
| Data integrity check | Room query counting days + comparing dates | DayLogDao.getDateRange() + pure function |
| Recovery backup (localStorage) | Room backup to DataStore as emergency fallback | DataStore[Backup] |
| UUID generation (crypto.randomUUID()) | java.util.UUID.randomUUID() | Same |
| Settings subscription (custom event bus) | Room Flow on Settings table | settingsDao.observeSettings().flowOn(Dispatchers.IO) |
| Day data subscription (custom events per dateStr) | Room Flow querying by date | dayLogDao.observeDay(dateStr) |

### 6.3 Module Breakdown (Recommended)

```
app/
 +-- data/
 |   +-- local/
 |   |   +-- db/
 |   |   |   +-- AppDatabase.kt
 |   |   |   +-- DayLogDao.kt
 |   |   |   +-- SettingsDao.kt
 |   |   |   +-- entity/
 |   |   |       +-- DayLogEntity.kt
 |   |   |       +-- PrayerLog.kt
 |   |   |       +-- RelapseEvent.kt
 |   |   |       +-- TrainingLog.kt
 |   |   |       +-- AppUsage.kt
 |   |   +-- datastore/
 |   |       +-- BackupPreferences.kt
 |   +-- repository/
 |   |   +-- DayLogRepository.kt
 |   |   +-- SettingsRepository.kt
 |   |   +-- ScreenTimeRepository.kt
 |   |   +-- ImportExportRepository.kt
 |   +-- model/  (domain models, decoupled from entities)
 |       +-- DayLog.kt
 |       +-- ScoreBreakdown.kt
 |       +-- AnalyticsSummary.kt
 +-- domain/
 |   +-- ScoreCalculator.kt
 |   +-- PrayerTimeCalculator.kt
 |   +-- StreakComputer.kt
 |   +-- AnalyticsComputer.kt
 |   +-- BehavioralDateUtils.kt
 +-- service/
 |   +-- PrayerNotificationScheduler.kt
 |   +-- AutoMissPrayerWorker.kt
 |   +-- ScreenTimePollingService.kt
 +-- ui/
 |   +-- theme/ (Theme.kt, Color.kt, Type.kt)
 |   +-- navigation/ (AppNavigation.kt, BottomNavBar.kt)
 |   +-- components/
 |   |   +-- daily/ (PrayerSection, RelapseSection, TrainingSection, WeightSection, ScreenTimeSection)
 |   |   +-- analytics/ (ScoreGauge, BehavioralPatternBar, PrayerStatCard, RelapseHistoryHeatmap, StreakDisplay, FrequencyGrid, WeightChart, ScreenTimeChart)
 |   |   +-- common/ (Skeleton, Modal, Toast)
 |   +-- screen/ (DailyScreen, AnalyticsScreen, SettingsScreen, OnboardingScreen)
 |   +-- viewmodel/ (DailyViewModel, AnalyticsViewModel, SettingsViewModel)
 +-- di/ (AppModule.kt — if using Hilt/Koin)
```

### 6.4 Key Android APIs Required

| API / Component | Purpose |
|---|---|
| UsageStatsManager.queryAndAggregateUsageStats() | Screen time per app per period |
| AppOpsManager.OPSTR_GET_USAGE_STATS | Check usage access permission |
| Settings.ACTION_USAGE_ACCESS_SETTINGS | Direct user to grant usage access |
| AlarmManager.setExactAndAllowWhileIdle() | Schedule prayer reminders and auto-miss |
| NotificationManager + NotificationChannel | Display all notifications |
| NotificationCompat.Builder | Build notification content |
| BroadcastReceiver (manifest-declared) | Receive alarm intents |
| Vibrator / VibrationEffect | Haptic feedback |
| FileProvider + Intent.ACTION_CREATE_DOCUMENT | Data export/import |
| WorkManager (optional) | Periodic screen time polling |
| ActivityResultContracts.RequestPermission | Runtime permission requests |
| Room with Flow | Local persistence + reactive queries |
| java.time (desugared for API < 26) | Date arithmetic (replaces date-fns) |
| DataStore[Preferences] | Settings storage (alternative to Room singleton) |

### 6.5 Permission Strategy

| Permission | When Requested | Rationale |
|---|---|---|
| PACKAGE_USAGE_STATS | On Settings screen, user taps "Enable" | Required for screen time tracking |
| POST_NOTIFICATIONS (API 33+) | On Settings screen, user taps "Enable" | Required for prayer notifications |
| SCHEDULE_EXACT_ALARM (API 31+) | On first notification schedule | Required for precise prayer time alarms |
| USE_EXACT_ALARM (API 34+) | Same as above | Android 14+ requires this for exact alarms |

- No INTERNET permission needed — the app is fully offline
- No FOREGROUND_SERVICE needed — screen time polling via WorkManager

### 6.6 Background Work Strategy

| Task | Mechanism | Frequency |
|---|---|---|
| Screen time polling | Coroutine + onResume/onPause lifecycle; WorkManager fallback | Every 5 min while foreground; periodic (>=15 min) when background |
| Prayer notifications | AlarmManager.setExactAndAllowWhileIdle() | Per prayer time |
| Auto-miss detection | AlarmManager.setExactAndAllowWhileIdle() — one alarm per prayer window end, set at app launch and after each day rollover. No periodic polling. | Once per prayer window |
| Recovery backup | Room transaction listener + DataStore | Every 5 data writes aggregated with a 5-second debounce |

### 6.7 Jetpack Compose Component Mapping

| Web Component | Compose Equivalent |
|---|---|
| div / section | Column, Row, Box |
| motion.div | Modifier.animateXxxAsState(), AnimatedVisibility |
| svg ring chart | Canvas + drawArc |
| Recharts LineChart | Vico library or custom Canvas |
| input type="time" | TimePickerDialog via showDatePicker |
| toggle groups | Row of FilterChip or custom ToggleButton |
| nav bottom bar | NavigationBar + NavigationBarItem (M3) |
| Modal | Dialog composable with AnimatedVisibility |
| Toaster | SnackbarHost in Scaffold |
| Skeleton | shimmer effect via Modifier.drawWithContent |
| CSS grid / flex | LazyVerticalGrid, Row, Column |
| lucide-react icons | Material Icons or custom ImageVector |

---

## 7. Risks, Missing Information, and Assumptions

### 7.1 Assumptions
1. Prayer times are fixed for Cairo — hardcoded Coordinates(30.0444, 31.2357) and CalculationMethod.Egyptian. The native app may want configurable location/method but this is absent in the current app.
2. Single user, no auth — fully offline with no multi-user support.
3. All data is local — no cloud sync. The native app must preserve this.
4. Adhan library: adhan-java (`com.batoulapps.adhan:adhan:2.0.0`) — locked. Supports all required calculation methods, schools, and latitude adjustment rules. No alternative library or reimplementation is needed.
5. One training session per type per day — UI only allows a single toggle.
6. Screen time is Android-only — no web fallbacks needed.

### 7.2 Risks
1. UsageStatsManager data delay — 15-30 minute refresh window. The current 5-min polling may show stale data. Consider queryUsageStats() with INTERVAL_DAILY for more reliable aggregation.
2. Exact alarm restrictions on Android 12+ — SCHEDULE_EXACT_ALARM requires user grant from system settings. Fall back to setWindow() when denied.
3. Background execution limits on Android 12+ — may affect screen time polling. WorkManager with 15-min periodic interval is safest.
4. IndexedDB -> Room migration — existing Capacitor users lose data unless "Import from MAN backup" path is provided.

### 7.3 Missing Information / Gaps
1. Network security config — the current AndroidManifest.xml allows cleartext to api.aladhan.com, but the app doesn't make network calls. Remove in native rewrite.
2. Training note/PR fields in TrainingLog — the web UI does not provide input for note, is_pr, or pr_details, but the fields exist in the type. In the native app, expose note, is_pr, and pr_details in the training log UI (see §4.4 for field specifications).
3. Timezone handling — current app uses Intl.DateTimeFormat().resolvedOptions().timeZone. Native app should use java.time.ZoneId.systemDefault().
4. The SettingsHelperPlugin — registered in settingsPlugin.ts but no native implementation exists. Handle notification settings and usage access settings via intents.
5. Data retention (`retention_months` field in UserSettings) — defined in types.ts but no UI toggle exists. The native app should decide whether to implement automatic data pruning based on this field, or remove it.

### 7.4 Prioritization for v1 Native

| Priority | Feature | Effort |
|---|---|---|
| P0 | Prayer tracking with auto-miss + adhan calculation | High |
| P0 | Relapse tracking | Low |
| P0 | Scoring engine | Medium |
| P0 | Daily screen / DayLog persistence (Room) | High |
| P0 | Bottom nav + screen navigation | Medium |
| P1 | Training tracking | Low |
| P1 | Weight tracking | Low |
| P1 | Screen time (UsageStats) | Medium |
| P1 | Settings (targets, timing, export/import) | High |
| P1 | Onboarding | Low |
| P2 | Analytics dashboard (weekly/monthly/yearly) | High |
| P2 | History heatmap / streaks / frequency grid | Medium |
| P0 | Prayer notifications + auto-miss alarms | Medium |
| P2 | Charts (score, screen time, weight) | Medium |
| P3 | Export readable report | Low |
| P3 | Data integrity check on startup | Low |
| P3 | Recovery backup to DataStore | Low |

Note: Prayer notifications and auto-miss alarms are P0 because:
1. Auto-miss detection is the mechanism by which pending prayers become missed. Without it, prayers are never auto-marked, making the prayer score (50% of total) unreliable.
2. The scoring engine depends on correct prayer statuses. Deferring auto-miss to P2 means the core daily score is broken for all v1 users.

---

*End of specification. This document covers 100% of the observable behavior in the source web app and provides a concrete Android-native blueprint.*
