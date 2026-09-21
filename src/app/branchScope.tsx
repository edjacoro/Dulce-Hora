/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Branch } from "./api";
import { setApiBranchScope } from "./api";

const STORAGE_KEY = "dulce-hora-active-branch-v1";

export function formatBranchName(name: string | undefined) {
  if (!name) return "JURAMENTO - Villa Urquiza";
  if (name === "Consolidado" || name.toLowerCase().includes("juramento")) return name;
  return name.toLowerCase().includes("villa urquiza") ? `JURAMENTO - ${name}` : name;
}

type BranchScopeValue = {
  branchId: string;
  branchName: string;
  consolidated: boolean;
  branches: Branch[];
  setBranchId: (branchId: string) => void;
};

const BranchScopeContext = createContext<BranchScopeValue | null>(null);

export function BranchScopeProvider({ branches, children }: { branches: Branch[]; children: ReactNode }) {
  const queryClient = useQueryClient();
  const activeBranches = useMemo(() => branches.filter((branch) => branch.active), [branches]);
  const defaultBranchId = activeBranches[0]?.id ?? "all";
  const [branchId, setBranchIdState] = useState(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === "all" || activeBranches.some((branch) => branch.id === stored) ? stored! : defaultBranchId;
    setApiBranchScope(initial);
    return initial;
  });
  const effectiveBranchId =
    branchId === "all" || activeBranches.some((branch) => branch.id === branchId) ? branchId : defaultBranchId;

  useEffect(() => {
    setApiBranchScope(effectiveBranchId);
  }, [effectiveBranchId]);

  const setBranchId = useCallback((nextBranchId: string) => {
    if (nextBranchId !== "all" && !activeBranches.some((branch) => branch.id === nextBranchId)) return;
    setApiBranchScope(nextBranchId);
    window.localStorage.setItem(STORAGE_KEY, nextBranchId);
    setBranchIdState(nextBranchId);
    void queryClient.invalidateQueries();
  }, [activeBranches, queryClient]);

  const selected = activeBranches.find((branch) => branch.id === effectiveBranchId);
  const value = useMemo(
    () => ({
      branchId: effectiveBranchId,
      branchName: effectiveBranchId === "all" ? "Consolidado" : formatBranchName(selected?.name),
      consolidated: effectiveBranchId === "all",
      branches: activeBranches,
      setBranchId
    }),
    [activeBranches, effectiveBranchId, selected, setBranchId]
  );

  return <BranchScopeContext.Provider value={value}>{children}</BranchScopeContext.Provider>;
}

export function useBranchScope() {
  const value = useContext(BranchScopeContext);
  if (!value) throw new Error("useBranchScope debe usarse dentro de BranchScopeProvider");
  return value;
}
