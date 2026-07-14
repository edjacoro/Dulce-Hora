import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  Clock3,
  Coffee,
  CreditCard,
  Download,
  Plus,
  ReceiptText,
  ShoppingBag
} from "lucide-react";
import { useState } from "react";
import { api, type SalesDocument, type SalesSummary } from "../api";
import { downloadSalesPdf } from "../reportPdf";

type SalesResponse = {
  documents: SalesDocument[];
};

type PeriodMode = "day" | "range";

type CorporateSaleForm = {
  saleDate: string;
  saleTime: string;
  customerName: string;
  total: string;
  paymentMethod: "efectivo" | "virtual" | "credito" | "debito" | "otro";
  notes: string;
};

const emptyCorporateSaleForm = (): CorporateSaleForm => ({
  saleDate: today(),
  saleTime: "",
  customerName: "",
  total: "",
  paymentMethod: "virtual",
  notes: ""
});

export function SalesPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<PeriodMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [from, setFrom] = useState(() => monthStart());
  const [to, setTo] = useState(() => today());
  const [corporateForm, setCorporateForm] = useState<CorporateSaleForm>(() => emptyCorporateSaleForm());
  const effectiveFrom = mode === "day" ? selectedDate : from;
  const effectiveTo = mode === "day" ? selectedDate : to;
  const query = dateQuery(effectiveFrom, effectiveTo);
  const recordsQuery = query ? `${query}&limit=120` : "?limit=120";

  const summary = useQuery({
    queryKey: ["sales-summary", effectiveFrom, effectiveTo],
    queryFn: () => api<SalesSummary>(`/api/sales/summary${query}`)
  });
  const sales = useQuery({
    queryKey: ["sales-documents", effectiveFrom, effectiveTo],
    queryFn: () => api<SalesResponse>(`/api/sales/documents${recordsQuery}`)
  });
  const createCorporateSale = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ id: string }>("/api/sales/corporate", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setCorporateForm(emptyCorporateSaleForm());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["cashflow-dashboard"] })
      ]);
    }
  });

  const documents = sales.data?.documents ?? [];
  const stats = summary.data?.summary;
  const isDayMode = mode === "day";
  const activePeriodLabel = isDayMode ? formatFullDate(selectedDate) : `${from} al ${to}`;

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Ventas</h1>
          <p>Estadisticas de facturacion sincronizada desde Dulce Hora</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            disabled={!summary.data}
            onClick={() => {
              if (summary.data) void downloadSalesPdf(summary.data, documents, activePeriodLabel);
            }}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            PDF
          </button>
          <PeriodControls
            mode={mode}
            selectedDate={selectedDate}
            from={from}
            to={to}
            onMode={setMode}
            onDate={setSelectedDate}
            onFrom={setFrom}
            onTo={setTo}
          />
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi
          icon={BadgeDollarSign}
          label="Venta neta"
          value={formatCurrency(stats?.netSales ?? 0)}
          tone="red"
        />
        <Kpi icon={ReceiptText} label="Tickets" value={stats?.tickets ?? 0} tone="blue" />
        <Kpi
          icon={CreditCard}
          label="Ticket promedio"
          value={formatCurrency(stats?.averageTicket ?? 0)}
          tone="green"
        />
        <Kpi
          icon={ShoppingBag}
          label="Articulos por ticket"
          value={formatNumber(stats?.unitsPerTicket ?? 0)}
          tone="amber"
        />
        <Kpi
          icon={Coffee}
          label={isDayMode ? "Cafes del dia" : "Cafes del intervalo"}
          value={formatNumber(stats?.coffeeCount ?? 0)}
          tone="green"
        />
      </div>

      <section className="content-band compact-band">
        <div className="table-heading">
          <h2>
            <Building2 size={18} aria-hidden="true" />
            Venta corporativa
          </h2>
          <span className="period-chip">Carga manual</span>
        </div>
        <form
          className="form-grid dense-form"
          onSubmit={(event) => {
            event.preventDefault();
            const total = Number(corporateForm.total);
            if (!Number.isFinite(total) || total <= 0) return;
            createCorporateSale.mutate({
              saleDate: corporateForm.saleDate,
              saleTime: corporateForm.saleTime || null,
              customerName: corporateForm.customerName,
              total,
              paymentMethod: corporateForm.paymentMethod,
              notes: corporateForm.notes
            });
          }}
        >
          <label>
            Fecha
            <input
              value={corporateForm.saleDate}
              onChange={(event) => setCorporateForm((current) => ({ ...current, saleDate: event.target.value }))}
              type="date"
            />
          </label>
          <label>
            Hora
            <input
              value={corporateForm.saleTime}
              onChange={(event) => setCorporateForm((current) => ({ ...current, saleTime: event.target.value }))}
              type="time"
            />
          </label>
          <label>
            Cliente
            <input
              value={corporateForm.customerName}
              onChange={(event) => setCorporateForm((current) => ({ ...current, customerName: event.target.value }))}
              placeholder="Empresa o contacto"
            />
          </label>
          <label>
            Medio
            <select
              value={corporateForm.paymentMethod}
              onChange={(event) =>
                setCorporateForm((current) => ({
                  ...current,
                  paymentMethod: event.target.value as CorporateSaleForm["paymentMethod"]
                }))
              }
            >
              <option value="efectivo">Efectivo</option>
              <option value="virtual">Transferencias</option>
              <option value="credito">Posnet</option>
              <option value="debito">Cuenta DNI</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label>
            Total
            <input
              value={corporateForm.total}
              onChange={(event) => setCorporateForm((current) => ({ ...current, total: event.target.value }))}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
          <label>
            Nota
            <input
              value={corporateForm.notes}
              onChange={(event) => setCorporateForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Detalle interno"
            />
          </label>
          {createCorporateSale.error ? <p className="form-error">{createCorporateSale.error.message}</p> : null}
          {createCorporateSale.isSuccess ? <p className="form-success">Venta corporativa cargada.</p> : null}
          <button className="primary-button full" disabled={createCorporateSale.isPending} type="submit">
            <Plus size={17} aria-hidden="true" />
            {createCorporateSale.isPending ? "Guardando..." : "Guardar venta corporativa"}
          </button>
        </form>
      </section>

      {documents.length === 0 ? (
        <section className="content-band">
          <div className="empty-state">
            <ReceiptText size={22} aria-hidden="true" />
            <div>
              <h2>Sin comprobantes importados</h2>
              <p>Usa Importaciones para sincronizar una fecha desde Dulce Hora.</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="split-layout">
            <section className="content-band compact-band">
              <h2>
                <CreditCard size={18} aria-hidden="true" />
                Medios de pago
              </h2>
              <BarList
                rows={summary.data?.byPayment ?? []}
                valueLabel={(value) => formatCurrency(value)}
              />
            </section>

            <section className="content-band compact-band">
              <h2>
                <Clock3 size={18} aria-hidden="true" />
                Venta por hora
              </h2>
              <BarList
                rows={(summary.data?.byHour ?? []).map((row) => ({
                  ...row,
                  label: row.label === "Sin hora" ? row.label : `${row.label}:00`
                }))}
                valueLabel={(value) => formatCurrency(value)}
              />
            </section>
          </div>

          <section className="content-band">
            <h2>
              <ShoppingBag size={18} aria-hidden="true" />
              Productos con mayor venta
            </h2>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.data?.topProducts ?? []).map((product) => (
                    <tr key={product.label}>
                      <td>{product.label}</td>
                      <td>{formatNumber(Number(product.quantity))}</td>
                      <td>{formatCurrency(Number(product.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="content-band">
            <h2>
              <ReceiptText size={18} aria-hidden="true" />
              Comprobantes
            </h2>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Numero</th>
                    <th>Medio</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        {document.sale_date}
                        {document.sale_time ? ` ${document.sale_time}` : ""}
                      </td>
                      <td>{document.document_type}</td>
                      <td>{document.document_number ?? document.external_id}</td>
                      <td>{formatPaymentMethod(document.payment_method)}</td>
                      <td>{document.item_count}</td>
                      <td>{formatCurrency(Number(document.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

type DateFiltersProps = {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
};

type PeriodControlsProps = DateFiltersProps & {
  mode: PeriodMode;
  selectedDate: string;
  onMode: (value: PeriodMode) => void;
  onDate: (value: string) => void;
};

function PeriodControls({
  mode,
  selectedDate,
  from,
  to,
  onMode,
  onDate,
  onFrom,
  onTo
}: PeriodControlsProps) {
  return (
    <div className="period-controls">
      <div className="control-tabs" aria-label="Modo de fechas">
        <button
          className={`mode-tab ${mode === "day" ? "active" : ""}`}
          onClick={() => onMode("day")}
          type="button"
        >
          Dia
        </button>
        <button
          className={`mode-tab ${mode === "range" ? "active" : ""}`}
          onClick={() => onMode("range")}
          type="button"
        >
          Intervalo
        </button>
      </div>

      {mode === "day" ? (
        <div className="day-nav">
          <button
            className="nav-button"
            onClick={() => onDate(shiftDate(selectedDate, -1))}
            type="button"
            aria-label="Dia anterior"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="date-display">
            <strong>{formatFullDate(selectedDate)}</strong>
            <input type="date" value={selectedDate} onChange={(event) => onDate(event.target.value)} />
          </div>
          <button
            className="nav-button"
            onClick={() => onDate(shiftDate(selectedDate, 1))}
            type="button"
            aria-label="Dia siguiente"
          >
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <DateFilters from={from} to={to} onFrom={onFrom} onTo={onTo} />
      )}
    </div>
  );
}

function DateFilters({ from, to, onFrom, onTo }: DateFiltersProps) {
  return (
    <div className="date-filter">
      <label>
        Desde
        <input type="date" value={from} onChange={(event) => onFrom(event.target.value)} />
      </label>
      <label>
        Hasta
        <input type="date" value={to} onChange={(event) => onTo(event.target.value)} />
      </label>
    </div>
  );
}

type KpiProps = {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: "red" | "blue" | "green" | "amber";
};

function Kpi({ icon: Icon, label, value, tone }: KpiProps) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

type BarListRow = {
  label: string;
  total: string;
  documents?: string;
};

function BarList({ rows, valueLabel }: { rows: BarListRow[]; valueLabel: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total)));
  if (rows.length === 0) {
    return <p className="muted-text">Sin datos en el rango seleccionado.</p>;
  }

  return (
    <div className="bar-list">
      {rows.map((row) => {
        const value = Number(row.total);
        return (
          <div className="bar-row" key={row.label}>
            <span>{row.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
            <strong>{valueLabel(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function dateQuery(from: string, to: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const value = params.toString();
  return value ? `?${value}` : "";
}

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthStart() {
  return `${today().slice(0, 8)}01`;
}

function shiftDate(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + delta);
  return formatDateInput(date);
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatFullDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatPaymentMethod(value: string | null) {
  const labels: Record<string, string> = {
    virtual: "Transferencias",
    credito: "Posnet",
    debito: "Cuenta DNI",
    efectivo: "efectivo",
    multiple: "Mixto Dulce Hora",
    pedidosya: "Pedidos Ya",
    rappi: "Rappi"
  };
  return value ? labels[value.toLowerCase()] ?? value : "Sin dato";
}
