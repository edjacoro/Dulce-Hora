import type { Request } from "express";
import { queryOne } from "./db.js";

export type BranchScope = {
  branchId: string | null;
  branchName: string;
  consolidated: boolean;
};

export async function readBranchScope(req: Request, organizationId: string): Promise<BranchScope> {
  const requested = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";
  if (requested === "all") {
    return { branchId: null, branchName: "Consolidado", consolidated: true };
  }

  const branch = await queryOne<{ id: string; name: string }>(
    `select id, name
     from branches
     where organization_id = $1
       and active = true
       ${requested ? "and id = $2" : ""}
     order by created_at
     limit 1`,
    requested ? [organizationId, requested] : [organizationId]
  );

  if (!branch) {
    const error = new Error(requested ? "La sucursal seleccionada no existe o no esta activa" : "No hay una sucursal activa");
    Object.assign(error, { statusCode: 400 });
    throw error;
  }

  return { branchId: branch.id, branchName: branch.name, consolidated: false };
}

export async function readWriteBranch(req: Request, organizationId: string, bodyBranchId?: string | null) {
  const queryBranchId = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";
  const requested = bodyBranchId?.trim() || queryBranchId;
  if (requested === "all") {
    const error = new Error("Selecciona una sucursal concreta para guardar o sincronizar datos");
    Object.assign(error, { statusCode: 400 });
    throw error;
  }

  const branch = await queryOne<{ id: string; name: string }>(
    `select id, name
     from branches
     where organization_id = $1
       and active = true
       ${requested ? "and id = $2" : ""}
     order by created_at
     limit 1`,
    requested ? [organizationId, requested] : [organizationId]
  );

  if (!branch) {
    const error = new Error("No hay una sucursal activa valida para guardar los datos");
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
  return branch;
}

export function addBranchScopeFilter(
  filters: string[],
  params: unknown[],
  column: string,
  scope: BranchScope
) {
  if (!scope.branchId) return;
  params.push(scope.branchId);
  filters.push(`${column} = $${params.length}`);
}
