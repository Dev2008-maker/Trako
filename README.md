# TRAKO — Pune Transit

> Know your bus. Know your stop.

TRAKO is a modern, passenger-first public transit application built for the **Pune Mahanagar Parivahan Mahamandal Ltd (PMPML)** bus network in Pune, India.

It connects commuters directly to real transit data, providing route exploration, timetable schedules, nearest bus stop discovery, live bus tracking, and smart stop arrival alarms.

---

## Core Features Currently Implemented

- **Nearest Bus Stops:**
  - Real-time geolocation to find the nearest PMPML stops within walking distance.
  - Walking distance estimation and walking time calculated using high-precision Haversine formulas.
  - Dynamic stop search across 6,700+ registered stops in Pune.

- **Upcoming & Nearby Buses:**
  - View real-time and scheduled bus departures for any selected stop.
  - Accurate countdowns, destination terminus details, and route numbers.

- **Complete Route Explorer:**
  - Browse and search 300+ official PMPML routes.
  - Interactive route details showing complete stop sequence timelines, route polylines, and distance markers.
  - Direct links to boarding and destination stops with fare calculations.

- **Live Bus Tracking & Journey Mode:**
  - Real-time bus simulation and GTFS-Realtime tracking along actual route geometry.
  - Animated live bus marker with heading rotation and dynamic travel progress indicators.
  - Jitter-free camera tracking with the **"Following Bus"** mode and manual pan/zoom freedom.

- **Auto Stop Alarm:**
  - Client-side proximity monitoring toward destination stops.
  - Dual-mode trigger: "1 Stop Before" or "2 Stops Before" (or distance thresholds).
  - Melodic chimes via Web Audio API and haptic vibration feedback via `navigator.vibrate`.
  - Browser notifications for background arrival alerts.

- **User Accounts & Preferences:**
  - Supabase-backed authentication (email & password) with session persistence.
  - 100% accessible in Guest Mode without requiring an account.
  - Travel history and personalized stop alarm preferences stored securely.

---

## Technology Stack

- **Frontend & Routing:** [React 19](https://react.dev/), [TanStack Start](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router) (type-safe file-based routing with SSR), [TanStack Query](https://tanstack.com/query).
- **Styling & Components:** [Tailwind CSS](https://tailwindcss.com/), Radix UI primitives, Lucide icons, Sonner toast notifications.
- **Mapping & Visualization:** [MapLibre GL](https://maplibre.org/), [MapTiler](https://www.maptiler.com/) Vector Street navigation tiles.
- **Backend & Database:** [Supabase](https://supabase.com/) PostgreSQL hosting the full Pune PMPML GTFS database.
- **Realtime Feeds:** Protocol buffers (`gtfs-realtime-bindings`) for PMPML GTFS-RT position feeds with graceful simulated interpolation when live hardware telemetry is unavailable.

---

## GTFS Database Overview

TRAKO runs on a comprehensive Pune PMPML General Transit Feed Specification (GTFS) database hosted on Supabase:

| Table        | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `stops`      | 6,713 bus stops across Pune, Pimpri-Chinchwad, and suburban areas. |
| `routes`     | 309 active PMPML bus routes with route numbers and descriptions.   |
| `trips`      | 15,236 scheduled trips linking routes with schedules.              |
| `stop_times` | 637,653 individual stop arrival/departure times.                   |
| `shapes`     | 254,422 geographic coordinates mapping route geometries.           |
| `calendar`   | Service operation calendars for weekday and weekend schedules.     |

_Note: Live vehicle positions depend on active GTFS-RT feed availability from transit operators; when upstream vehicle GPS feeds are intermittent, TRAKO seamlessly uses timetable interpolation and passenger journey tracking._

---

## Local Development Setup

### 1. Prerequisites

- Node.js 20+ (recommended Node 22+)
- npm or bun

### 2. Install Dependencies

```sh
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_MAPTILER_API_KEY=your_maptiler_api_key
```

### 4. Start Development Server

```sh
npm run dev
```

The application will be running locally at `http://localhost:3000`.

### 5. Build for Production

```sh
npm run build
npm run preview
```

---

## Quality Assurance & Verification

```sh
npm run lint         # ESLint checks
npx tsc --noEmit     # TypeScript type safety checks
npm run build        # Production bundle compilation
```
