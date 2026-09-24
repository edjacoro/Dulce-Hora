import assert from "node:assert/strict";
import test from "node:test";
import { datesNeedingBaseRefresh, recentDetailWindow } from "../server/recentProductBackfill.js";

test("la recuperacion reciente queda limitada al dia actual y los tres anteriores", () => {
  const window = recentDetailWindow("2026-09-24", 4);

  assert.deepEqual(window, {
    dateFrom: "2026-09-21",
    dateTo: "2026-09-24",
    dates: ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]
  });
});

test("no vuelve a leer dias cerrados y sincronizados, salvo el dia vivo", () => {
  const window = recentDetailWindow("2026-09-24", 4);
  const alreadySynced = ["2026-09-21", "2026-09-22", "2026-09-24"];

  assert.deepEqual(datesNeedingBaseRefresh(window, alreadySynced, true), ["2026-09-23", "2026-09-24"]);
  assert.deepEqual(datesNeedingBaseRefresh(window, alreadySynced, false), ["2026-09-23"]);
});

test("la ventana no permite ampliarse accidentalmente hacia el historial", () => {
  const window = recentDetailWindow("2026-09-24", 99);
  assert.equal(window.dates.length, 4);
  assert.equal(window.dateFrom, "2026-09-21");
});
