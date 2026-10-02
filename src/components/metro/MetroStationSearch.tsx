import { useState, useMemo } from "react";
import { searchMetroStations } from "@/data/metro/service";
import type { MetroStation } from "@/data/metro/types";
import { Search, X, MapPin, ChevronRight } from "lucide-react";

interface MetroStationSearchProps {
  onSelectStation: (stationId: string) => void;
  className?: string;
}

export function MetroStationSearch({
  onSelectStation,
  className = "",
}: MetroStationSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => {
    return searchMetroStations(query);
  }, [query]);

  const handleSelect = (stationId: string) => {
    onSelectStation(stationId);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input Box */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-xs focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Search Pune Metro stations, landmarks..."
          className="w-full text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="size-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-1.5 inset-x-0 z-40 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg scrollbar-thin">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {query
                ? `Found ${results.length} stations`
                : "All Metro Stations (30)"}
            </div>

            {results.length === 0 ? (
              <p className="p-3 text-xs text-center text-muted-foreground">
                No metro stations match "{query}"
              </p>
            ) : (
              results.map((st) => {
                const isLine1 = st.lineId === "line-1";
                const isUnderConst = st.status === "UNDER_CONSTRUCTION";

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelect(st.id)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`size-2.5 rounded-full shrink-0 ${
                          isLine1 ? "bg-[#800080]" : "bg-[#0284c7]"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary">
                          {st.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {st.marathiName ? `${st.marathiName} · ` : ""}
                          {st.landmark}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {st.isInterchange && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          ⇄ Interchange
                        </span>
                      )}
                      {isUnderConst && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          🚧
                        </span>
                      )}
                      <ChevronRight className="size-3 text-slate-300 group-hover:text-slate-500" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MetroStationSearch;
