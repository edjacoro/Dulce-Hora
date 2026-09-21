import assert from "node:assert/strict";
import test from "node:test";
import { addBranchScopeFilter } from "../server/branchScope.js";

test("agrega el filtro de sucursal concreta sin alterar los parametros previos", () => {
  const filters = ["b.organization_id = $1"];
  const params: unknown[] = ["org-1"];

  addBranchScopeFilter(filters, params, "b.id", {
    branchId: "branch-1",
    branchName: "Juramento",
    consolidated: false
  });

  assert.deepEqual(filters, ["b.organization_id = $1", "b.id = $2"]);
  assert.deepEqual(params, ["org-1", "branch-1"]);
});

test("el consolidado conserva la consulta sin filtro de sucursal", () => {
  const filters = ["b.organization_id = $1"];
  const params: unknown[] = ["org-1"];

  addBranchScopeFilter(filters, params, "b.id", {
    branchId: null,
    branchName: "Consolidado",
    consolidated: true
  });

  assert.deepEqual(filters, ["b.organization_id = $1"]);
  assert.deepEqual(params, ["org-1"]);
});
