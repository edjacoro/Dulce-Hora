import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyRows } from "../server/finance.js";

test("separa P&L y calcula productividad laboral sin duplicar gastos", () => {
  const [row] = buildMonthlyRows({
    selectedMonth: "2026-09",
    sales: {
      rows: [{
        month: "2026-09",
        sales: "1000",
        documents: "10",
        tickets: "10",
        item_units: "16",
        days_with_sales: "2"
      }]
    },
    expenses: { rows: [{ month: "2026-09", total: "700" }] },
    waste: { rows: [{ month: "2026-09", total: "50" }] },
    expenseBreakdown: {
      rows: [{ month: "2026-09", cogs: "300", labor: "200", operating: "200" }]
    },
    laborHours: { rows: [{ month: "2026-09", hours: "20" }] }
  });

  assert.equal(row.cogs, 300);
  assert.equal(row.labor, 200);
  assert.equal(row.operatingExpenses, 200);
  assert.equal(row.waste, 50);
  assert.equal(row.result, 250);
  assert.equal(row.grossProfit, 650);
  assert.equal(row.margin, 25);
  assert.equal(row.grossMargin, 65);
  assert.equal(row.salesPerLaborHour, 50);
  assert.equal(row.ticketsPerLaborHour, 0.5);
  assert.equal(row.laborPercent, 20);
});
