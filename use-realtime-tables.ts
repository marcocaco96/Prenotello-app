import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to postgres_changes on the given tables and invokes
 * `handler` (debounced) whenever any change is received.
 *
 * Keeps a stable ref to the latest handler so callers don't need to memoize.
 */
export function useRealtimeTables(
  tables: string[],
  handler: () => void,
  debounceMs = 250,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Stable key so React effect doesn't churn when array identity changes
  const tablesKey = [...tables].sort().join(",");

  useEffect(() => {
    if (!tablesKey) return;
    const list = tablesKey.split(",");
    const channelName = `rt-${list.join("-")}-${Math.random().toString(36).slice(2, 8)}`;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handlerRef.current(), debounceMs);
    };

    const channel = supabase.channel(channelName);
    for (const t of list) {
      (channel as unknown as {
        on: (e: string, f: Record<string, string>, cb: () => void) => unknown;
      }).on("postgres_changes", { event: "*", schema: "public", table: t }, trigger);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tablesKey, debounceMs]);
}
