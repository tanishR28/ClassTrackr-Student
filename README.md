# ClassTrackr

**Smart attendance tracking for students**

A mobile-first React Native app built with Expo that helps students track their class attendance, manage weekly timetables, and stay on top of attendance thresholds.

---

## Features

- **Daily Attendance** — Mark each class as Present, Absent, or Cancelled directly from the home screen
- **Smart Auto-Processing** — Missed days are automatically filled in as Present when you open the app again
- **Weekly Timetable** — Set up your recurring schedule per day of the week (Mon–Sun)
- **Extra Lectures** — Log one-off lectures that aren't in your weekly timetable
- **Attendance Counter** — Manual +/- controls per subject with live percentage and threshold tracking
- **Pause Timetable** — Mark holidays or exam breaks; paused dates are skipped entirely
- **Mark All** — Quickly mark all today's classes as Absent or Cancelled in one tap
- **Color-coded Status** — Green / Orange / Red percentage indicators based on your threshold

---

## Screens

| Screen | Description |
|---|---|
| **Home** | Today's subjects with status controls, percentage, and extra lecture FAB |
| **Timetable** | Add/remove subjects per day of the week |
| **Manage Subjects** | Add (Lecture, Lab, or Both), delete, and view all subjects |
| **Subject Detail** | Manual counter for Total, Attended, and Threshold with inline editing |
| **Pause Timetable** | Set/clear a pause period (quick buttons or custom date) |
| **About** | App info, feature list, and usage guide |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK ~54 / React Native 0.81.5 |
| Navigation | Expo Router ~6 (file-based) |
| Database | expo-sqlite ~16 (WAL mode, FK cascade) |
| React | React 19.1.0 |
| UI | Pure React Native (no external UI library) |
| Build | EAS Build |

---

## Project Structure

```
ClassTrackr-Student/
├── app/
│   ├── _layout.js              Root layout — mounts SQLiteProvider
│   ├── index.js                Redirects to /home
│   ├── home.jsx                Daily attendance screen
│   ├── timetable.jsx           Weekly timetable editor
│   ├── manage-subjects.jsx     Subject management
│   ├── pause.jsx               Timetable pause / holiday setup
│   ├── about.jsx               About screen
│   └── subjects/[id].jsx       Per-subject attendance counter
├── components/
│   ├── AppSidebar.jsx          Slide-in navigation drawer
│   └── CustomAlert.js          Cross-platform alert helper
├── services/
│   └── database.js             All SQLite queries, schema, and processors
├── utils/
│   └── attendanceUtils.js      Percentage calculation and color helpers
├── assets/                     App icons and splash screen
├── app.json                    Expo config
└── eas.json                    EAS Build profiles
```

---

## Database Schema

```sql
subjects        (id, name, type[theory|lab], created_at)
attendance      (subject_id PK, total, present, threshold DEFAULT 75)
timetable       (id, day[Mon-Sun], subject_id, UNIQUE(day, subject_id))
daily_marks     (date, subject_id, status[present|absent|skip], processed)
extra_lectures  (date, subject_id, status[present|absent|skip], processed)
timetable_pause (id, start_date, end_date)
app_settings    (key, value)   -- tracks last_processed_date
```

All foreign keys cascade on delete. The `app_settings` table stores `last_processed_date` so the auto-processor knows where to resume from.

---

## How Attendance Processing Works

Every time you open the app, `processPendingMarks` runs automatically:

1. Iterates every calendar date from `last_processed_date + 1` to `yesterday`
2. For each date it checks the weekly timetable and your explicit marks
3. **Present** (default) → `total + 1`, `present + 1`
4. **Absent** → `total + 1` only
5. **Skip / Cancelled** → nothing applied
6. **Paused dates** → skipped entirely, no attendance recorded
7. Advances the `last_processed_date` pointer when done

This means you never need to back-fill manually — just open the app and it catches up.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android/iOS device or emulator

### Run in Development

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

> Note: The home screen launcher icon will show Expo Go's icon when running via Expo Go. A native build is required for your custom icon.

### Build for Testing (Preview APK)

```bash
eas build --profile preview --platform android
```

EAS will provide a download link for the `.apk` once the build completes.

### Build for Production

```bash
eas build --profile production --platform android
```

---

## EAS Build Profiles

| Profile | Distribution | Use Case |
|---|---|---|
| `development` | Internal | Dev client with live reload |
| `preview` | Internal | Test build — shareable APK |
| `production` | Store | Play Store / App Store release |

---

## Known Limitations

- **Web**: SQLite is not supported on web (`expo start --web` will not work correctly)
- The app is designed for **portrait orientation** only

---

## Developer

**Tanish Rane**

Built with care for students.
