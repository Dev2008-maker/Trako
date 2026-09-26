import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { livePingsQuery } from "@/lib/transit";
import { useDemoBuses } from "@/lib/demoBuses";

/** Live bus positions, kept fresh by realtime updates (one subscription only) and 3 continuous demo buses. */
export function useLiveBuses() {
  const queryClient = useQueryClient();
  const query = useQuery(livePingsQuery);
  const demoBuses = useDemoBuses();

  useEffect(() => {
    const channel = supabase
      .channel("bus-locations-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bus_locations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-pings"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    pings: query.data?.byBus ?? new Map(),
    trackerCount: query.data?.trackerCount ?? new Map(),
    demoBuses,
  };
}
