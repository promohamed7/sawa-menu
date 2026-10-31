"use client";

import { createContext, useContext } from "react";
import type { Catalog } from "@/lib/catalog";

export type Store = {
  catalog: Catalog;
  canOrder: boolean; // the live menu from the cashier is loaded
  qtyOf: (productId: number) => number; // for the person ordering now
  add: (productId: number, from?: DOMRect, who?: number) => void; // who defaults to the person ordering now
  setQty: (key: string, qty: number) => void;
  party: string[];
  active: number;
  setActive: (who: number) => void;
  addPerson: (name: string) => void;
  removePerson: (who: number) => void;
  openOrder: () => void;
};

export const StoreCtx = createContext<Store | null>(null);

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("StoreCtx missing");
  return v;
}
