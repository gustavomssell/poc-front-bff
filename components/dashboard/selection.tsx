"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type SelectionState = {
  symbol: string | null;
  select: (symbol: string) => void;
};

const SelectionContext = createContext<SelectionState>({
  symbol: null,
  select: () => {},
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState<string | null>(null);
  return (
    <SelectionContext.Provider value={{ symbol, select: setSymbol }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionState {
  return useContext(SelectionContext);
}
