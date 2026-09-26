# Phase 3.2.1 — Stabilization & Bug Fix

This phase only fixes bugs. The design, map style, branding, bottom navigation, GPS setup and stop alarm stay as they are.

## P0 fixes
1. **Blank maps (Nearby, Route Details, Journey Preview/Active)**
   - First, reproduce the blank map on each screen in the mobile preview and write down what causes it: the map area's height, when the map starts up, or the map's size not updating after changing pages.
   - Give every map area a fixed height that still adapts to the screen, and redraw the map at the right size after it first loads, when its area changes size, and after changing pages. Use the same map piece on every screen.
   - Fix the map warnings and errors shown in the browser at their source.
2. **Stop names instead of coordinates**
   - Look up each stop's name by following the trip, then its stop times, then the stop itself.
   - Everywhere passengers see a stop (route cards, route details, journey preview and tracking, nearby stops, timetables), show the stop name. If a name is missing, show "Unnamed stop", never raw coordinates.
   - Remove the made-up fallback stops (for example "Origin/Destination" placed at central Pune).
3. **Route details**: show the bus number, route name, and the names of the first and last stops, then the stops in order. Draw the line on the map from that route's own shape, not a guessed one.

## P1 fixes
- **Route status**: replace the "Active" label that every route shows with "Scheduled Service", unless the timetable actually proves the route is running today.
- **Live vs demo**: simulated buses say "DEMO LIVE" and real passenger locations say "LIVE". Delay values from the simulator are also marked as demo. Remove "LIVE PMPML TRACKING" whenever the bus is simulated.
- **One chosen journey**: keep a single chosen trip that Home, Route Preview, Route Details, Start Journey and Active Journey all read. Remove any bus or journey objects hard-coded into individual screens.
- **Nearby Stops**: use the real stops list and show each stop's name, walking distance and the route numbers that serve it. Only list stops that are actually close by.
- **Trips page**: replace "Coming soon" with the current journey (if there is one), plus any completed journeys already saved. If there are none, show "No journeys yet — Your completed journeys will appear here."
- **Sign-in page**: replace "Coming soon" with a simple email sign-in using the app's existing sign-in system, plus a "Continue as Guest" button. Guests can still use everything they could before.

## Validation
Run the 10 checks from the brief in the mobile preview, check the browser for errors, and make sure the app builds with no errors.

## Technical details
- MapCanvas: `ResizeObserver` on the holder, calling `map.resize()` on load and on route change; the wrappers get explicit heights (e.g. `h-[40vh] min-h-56`).
- Stop names come from `gtfs.ts` data or Supabase `stops.name`. Add a shared helper, `stopLabel()`, used everywhere.
- Selected journey: a small shared store (a React context or a search param holding `routeId`, `tripId` and `direction`), used by the journey components and by `routes.$routeId`.
- Trips page reads `tracking_sessions` for signed-in users. Sign-in uses the current `useAuth` with Supabase email/password.
