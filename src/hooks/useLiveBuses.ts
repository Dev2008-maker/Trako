import { useQuery } from "@tanstack/react-query";
import { livePingsQuery } from "@/lib/transit";

/** Live bus positions query wrapper. */
export function useLiveBuses() {
  const query = useQuery(livePingsQuery);

  return {
    pings: query.data?.byBus ?? new Map(),
    trackerCount: query.data?.trackerCount ?? new Map(),
  };
}
