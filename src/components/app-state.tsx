"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, type CallMeta, type Mode, type Samples, type ServerConfig } from "@/lib/api";

interface AppState {
  mode: Mode;
  setMode: (m: Mode) => void;
  config: ServerConfig | null;
  refreshConfig: () => Promise<void>;
  samples: Samples | null;
  inspect: (calls: CallMeta[], title: string) => void;
  inspected: { calls: CallMeta[]; title: string } | null;
  closeInspector: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("cached");
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [samples, setSamples] = useState<Samples | null>(null);
  const [inspected, setInspected] = useState<AppState["inspected"]>(null);

  const refreshConfig = useCallback(async () => setConfig(await api.config()), []);

  useEffect(() => {
    api.config().then((c) => {
      setConfig(c);
      setMode(c.default_mode);
    }).catch(() => {});
    api.samples().then(setSamples).catch(() => {});
  }, []);

  return (
    <Ctx.Provider
      value={{
        mode, setMode, config, refreshConfig, samples, inspected,
        inspect: (calls, title) => setInspected({ calls, title }),
        closeInspector: () => setInspected(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

/** Run an API call with loading/error state. Errors become friendly messages, never crashes. */
export function useRun<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const run = useCallback(async (fn: () => Promise<T>) => {
    const id = ++seq.current; // only the latest request may update state
    setLoading(true);
    setError(null);
    try {
      const d = await fn();
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);
  return { data, loading, error, run, setData };
}
