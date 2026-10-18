import * as XLSX from "xlsx";

export type PedidosYaOrder = {
  orderId: string;
  storeId: string;
  storeName: string;
  date: string;
  time: string;
  paymentKind: "online" | "cash";
  subtotal: number;
  estimatedIncome: number;
  cashCollected: number;
  amountOwed: number;
  payout: number;
  commission: number;
  onlinePaymentFee: number;
  tax: number;
  merchantDiscount: number;
  marketingCost: number;
};

export type PedidosYaCsvResult = {
  orders: PedidosYaOrder[];
  cancelledOrderIds: string[];
  excluded: number;
  awaitingAmounts: number;
  rows: number;
  storeId: string | null;
};

const required = [
  "Nro de pedido", "ID de tienda", "Nombre del local", "Estado del pedido", "Fecha del pedido",
  "Forma de pago", "Total parcial", "Ingreso estimado", "Monto en efectivo ya cobrado por el local",
  "Monto adeudado a PedidosYa", "Importe de pago", "Comisión", "Comisión por pago en línea", "Impuesto",
  "Descuento financiado por usted", "Total de costes de marketing"
];

export function parsePedidosYaCsv(csv: string, from: string, to: string): PedidosYaCsvResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error("Rango de fechas invalido");
  }
  const first = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(first.valueOf()) || Number.isNaN(last.valueOf()) ||
      first.toISOString().slice(0, 10) !== from || last.toISOString().slice(0, 10) !== to ||
      (last.valueOf() - first.valueOf()) / 86_400_000 >= 31) {
    throw new Error("El informe debe cubrir un intervalo valido de hasta 31 dias");
  }
  const workbook = XLSX.read(csv.replace(/^\uFEFF/, ""), { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("El informe esta vacio");
  const headers = (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0 })[0] ?? []).map(String);
  for (const header of required) {
    if (!headers.includes(header)) throw new Error(`Falta la columna ${header} del informe PedidosYa`);
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: true });
  const orders: PedidosYaOrder[] = [];
  const cancelledOrderIds: string[] = [];
  const seen = new Set<string>();
  let excluded = 0;
  let awaitingAmounts = 0;
  let storeId: string | null = null;
  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const id = String(row["Nro de pedido"] ?? "").trim();
    const currentStore = String(row["ID de tienda"] ?? "").trim();
    if (!/^\d{5,20}$/.test(id) || !/^\d+$/.test(currentStore)) throw new Error(`Pedido o tienda invalidos en fila ${line}`);
    if (seen.has(id)) throw new Error(`Pedido repetido en el CSV: ${id}`);
    seen.add(id);
    if (storeId && storeId !== currentStore) throw new Error("El archivo mezcla tiendas distintas");
    storeId = currentStore;
    const stamp = String(row["Fecha del pedido"] ?? "").trim();
    const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(stamp);
    if (!match || match[1] < from || match[1] > to) throw new Error(`Fecha fuera del rango elegido en fila ${line}`);
    const status = String(row["Estado del pedido"] ?? "").trim().toLowerCase();
    if (status === "cancelado") { cancelledOrderIds.push(`${currentStore}:${id}`); excluded++; continue; }
    if (status !== "entregado") { excluded++; continue; }
    if (!String(row["Forma de pago"] ?? "").trim() &&
        money(row["Ingreso estimado"], "Ingreso estimado", line) === 0) {
      awaitingAmounts++;
      excluded++;
      continue;
    }
    const payment = String(row["Forma de pago"] ?? "").trim().toLowerCase();
    const paymentKind = payment.includes("efectivo") ? "cash" : payment.includes("online") ? "online" : null;
    if (!paymentKind) throw new Error(`Forma de pago no reconocida en fila ${line}`);
    const amount = money(row["Total parcial"], "Total parcial", line);
    if (amount <= 0) throw new Error(`Total parcial invalido en fila ${line}`);
    orders.push({
      orderId: id,
      storeId: currentStore,
      storeName: String(row["Nombre del local"] ?? "").trim(),
      date: match[1],
      time: match[2],
      paymentKind,
      subtotal: amount,
      estimatedIncome: money(row["Ingreso estimado"], "Ingreso estimado", line),
      cashCollected: money(row["Monto en efectivo ya cobrado por el local"], "Monto en efectivo ya cobrado por el local", line),
      amountOwed: money(row["Monto adeudado a PedidosYa"], "Monto adeudado a PedidosYa", line),
      payout: money(row["Importe de pago"], "Importe de pago", line),
      commission: money(row["Comisión"], "Comisión", line),
      onlinePaymentFee: money(row["Comisión por pago en línea"], "Comisión por pago en línea", line),
      tax: money(row["Impuesto"], "Impuesto", line),
      merchantDiscount: money(row["Descuento financiado por usted"], "Descuento financiado por usted", line),
      marketingCost: money(row["Total de costes de marketing"], "Total de costes de marketing", line)
    });
  }
  return { orders, cancelledOrderIds, excluded, awaitingAmounts, rows: rows.length, storeId };
}

function money(input: unknown, label: string, line: number) {
  const raw = String(input ?? "").trim();
  if (!raw || raw === "-") return 0;
  if (!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/.test(raw)) {
    throw new Error(`${label} invalido en fila ${line}`);
  }
  const value = Number(raw.replaceAll(".", "").replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`${label} invalido en fila ${line}`);
  return value;
}
