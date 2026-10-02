# TRAKO — Agent Guidelines

> [!IMPORTANT]
> Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed — to prevent desynchronization with remote environments.
>
> Always keep branches in a clean, buildable, and working state.

## Project Guidelines

- **Architecture:** React 19 + TanStack Start (SSR) + TanStack Router + TanStack Query + Tailwind CSS + MapLibre GL + Supabase.
- **Data Integrity:** Real GTFS tables (`stops`, `routes`, `trips`, `stop_times`, `shapes`) are hosted in Supabase. Do not mutate or drop GTFS schema tables.
- **Styling:** Consistent purple & white theme (`#800080`, `#9932cc`, clean white/grey surfaces).
- **Code Quality:** Ensure `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass without regressions.
