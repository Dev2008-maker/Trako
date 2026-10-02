# 🚍 TRAKO — Pune Transit Companion

> **Know your bus. Know your stop. Complete your journey.**

TRAKO is a smart public-transit companion designed to make bus and metro journeys in Pune easier, safer, and more predictable.

It helps users discover nearby PMPML bus stops, plan journeys, track their trip, receive stop alerts, and combine bus and metro travel.

---

## 🚀 Why TRAKO?

Public transportation can be difficult to navigate, especially for students, newcomers, and daily commuters.

Common problems include:

- Finding the correct bus stop
- Knowing which route to take
- Understanding scheduled timings
- Knowing when to get off the bus
- Tracking a journey in real time
- Planning bus + metro journeys
- Recovering when a stop is missed
- Sharing a journey with family or friends

**TRAKO brings these capabilities together in one transit-focused application.**

---

## ✨ Key Features

### 📍 Smart Stop Discovery
Automatically detects the user's location and identifies nearby PMPML bus stops.

### 🔔 Smart Stop Alarm
Set a destination and receive an alert when approaching the selected stop.

### 🚌 Journey Tracking
Track your journey with:

- Current location
- Route information
- Upcoming stops
- Estimated arrival information
- Journey progress

### 🗺️ Interactive Transit Map
Map-based visualization for:

- Current location
- Bus stops
- Routes
- Journey progress
- Transit information

### ⭐ Saved Journeys
Save frequently used journeys with custom names such as:

- 🏠 Home
- 🎓 College
- 💼 Work

### ⏰ Leave At / Arrive By
Plan a journey around a future departure or arrival time.

### 🚇 Bus + Metro Planning
TRAKO is designed to support multimodal journeys involving:

**PMPML Bus + Pune Metro**

### 🔄 Missed-Stop Recovery
If a passenger misses their intended stop, TRAKO can help identify the next available recovery option.

### 👥 Family & Community Sharing
Users can create journey groups and share temporary journey/location information with invited members.

### 🔐 Authentication & Privacy
Authenticated features use Supabase authentication and database security policies to protect user data.

---

## 🧠 How TRAKO Works

```text
User Location
      ↓
Nearest Stop Detection
      ↓
Destination Selection
      ↓
Transit Data / Route Processing
      ↓
Journey Planning
      ↓
Live Journey Tracking
      ↓
Stop Alert / Journey Completion
🏗️ Technology Stack
Frontend
React
TypeScript
Tailwind CSS
TanStack Router
TanStack Query
Maps
MapLibre GL
MapTiler
Backend & Database
Supabase
PostgreSQL
Supabase Realtime
Transit Data
GTFS
PMPML transit data
Authentication
Supabase Auth
🗃️ Transit Data

TRAKO uses GTFS-based public transit data for route and schedule information.

The application works with transit entities such as:

Routes
Trips
Stops
Stop Times
Shapes
Calendars

This enables TRAKO to provide structured transit information instead of relying only on static map locations.

🛠️ Project Architecture
                 ┌─────────────────────┐
                 │      TRAKO App      │
                 └──────────┬──────────┘
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
        Geolocation       Maps        User Input
             │              │              │
             └──────────────┼──────────────┘
                            ↓
                  Journey / Route Engine
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
          GTFS Data      Supabase      Realtime
             │              │              │
             └──────────────┼──────────────┘
                            ↓
                   Journey Information
                            ↓
                    Smart Stop Alert
