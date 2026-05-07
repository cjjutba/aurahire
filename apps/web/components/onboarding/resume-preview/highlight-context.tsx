"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface HighlightContextValue {
  hoveredFieldId: string | null;
  setHoveredFieldId: (id: string | null) => void;
  focusField: (id: string) => void;
  registerField: (id: string, focus: () => void) => () => void;
}

const HighlightContext = createContext<HighlightContextValue | null>(null);

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const fields = useRef<Map<string, () => void>>(new Map());

  const registerField = useCallback((id: string, focus: () => void) => {
    fields.current.set(id, focus);
    return () => {
      fields.current.delete(id);
    };
  }, []);

  const focusField = useCallback((id: string) => {
    fields.current.get(id)?.();
  }, []);

  return (
    <HighlightContext.Provider
      value={{ hoveredFieldId, setHoveredFieldId, focusField, registerField }}
    >
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlightContext(): HighlightContextValue {
  const v = useContext(HighlightContext);
  if (!v) throw new Error("useHighlightContext must be inside <HighlightProvider>");
  return v;
}
