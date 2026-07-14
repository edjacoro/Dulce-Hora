import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Clock3,
  ReceiptText,
  ShoppingBag,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { useMemo, useState } from "react";
import { api, type HourPerformance } from "../api";

type PeriodMode = "day" | "month" | "range";
type SortDirection = "asc" | "desc";
type HourRow = HourPerformance["hours"][number];
type WeekdayRow = HourPerformance["weekdays"][number];
type HourSortKey =
  | "label"
  | "revenue"
  | "tickets"
  | "averageTicket"
  | "itemUnits"
  | "unitsPerTicket"
  | "share"
  | "ticketShare"
  | "revenuePerDay"
  | "ticketsPerDay"
  | "signal";
type WeekdaySortKey =
  | "label"
  | "revenue"
  | "tickets"
  | "averageTicket"
  | "share"
  | "ticketShare"
  | "observedDays"
  | "revenuePerDay"
  | "ticketsPerDay"
  | "signal";

export function HoursPage() {
  const [mode, setMode] = useState<PeriodMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [selectedMonth, setSelectedMonth] = useState(() => today().slice(0, 7));
  const [from, setFrom] = useState(() => monthStart());
  const [to, setTo] = useState(() => today());
  const [sort, setSort] = useState<{ key: HourSortKey; direction: SortDirection }>({
    key: "revenue",
    direction: "desc"
  });
  const [weekdaySort, setWeekdaySort] = useState<{ key: WeekdaySortKey; direction: SortDirection }>({
    key: "revenuePerDay",
    direction: "desc"
  });
  const period = useMemo(
    () => periodRange({ mode, selectedDate, selectedMonth, from, to }),
    [mode, selectedDate, selectedMonth, from, to]
  );
  const query = dateQuery(period.from, period.to);
  const performance = useQuery({
    queryKey: ["hour-performance", period.from, period.to],
    queryFn: () => api<HourPerformance>(`/api/hours/performance${query}`)
  });

  const data = performance.data;
  const hours = useMemo(() => data?.hours ?? [], [data?.hours]);
  const weekdays = useMemo(() => data?.weekdays ?? [], [data?.weekdays]);
  const sortedHours = useMemo(() => sortHours(hours, sort), [hours, sort]);
  const sortedWeekdays = useMemo(() => sortWeekdays(weekdays, weekdaySort), [weekdays, weekdaySort]);
  const strongestSales = [...hours].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const strongestTickets = [...hours].sort((a, b) => b.tickets - a.tickets).slice(0, 5);
  const weakHours = [...hours]
    .filter((hour) => hour.revenue > 0 || hour.tickets > 0)
    .sort((a, b) => a.revenue - b.revenue || a.tickets - b.tickets)
    .slice(0, 5);
  const strongestWeekdaySales = [...weekdays].sort((a, b) => b.revenuePerDay - a.revenuePerDay).slice(0, 5);
  const strongestWeekdayTickets = [...weekdays].sort((a, b) => b.ticketsPerDay - a.ticketsPerDay).slice(0, 5);
  const weakWeekdays = [...weekdays]
    .filter((weekday) => weekday.revenue > 0 || weekday.tickets > 0)
    .sort((a, b) => a.revenuePerDay - b.revenuePerDay || a.ticketsPerDay - b.ticketsPerDay)
    .slice(0, 5);

  return (
    <section className="page-section hours-page">
      <div className="page-heading">
        <div>
          <h1>Horarios</h1>
          <p>Horas fuertes y debiles por venta, tickets y ticket promedio</p>
        </div>
        <HourPeriodControls
          mode={mode}
          selectedDate={selectedDate}
          selectedMonth={selectedMonth}
          from={from}
          to={to}
          onMode={setMode}
          onDate={setSelectedDate}
          onMonth={setSelectedMonth}
          onFrom={setFrom}
          onTo={setTo}
        />
      </div>

      {performance.isLoading ? (
        <section className="content-band">
          <p className="muted-text">Cargando horarios...</p>
        </section>
      ) : null}
      {performance.error ? <p className="form-error">{performance.error.message}</p> : null}

      {data ? (
        <>
          <div className="kpi-grid">
            <Kpi icon={BadgeDollarSign} label="Venta total" value={formatCurrency(data.summary.revenue)} tone="blue" />
            <Kpi icon={ReceiptText} label="Tickets" value={formatInteger(data.summary.tickets)} />
            <Kpi icon={BarChart3} label="Ticket promedio" value={formatCurrency(data.summary.averageTicket)} />
            <Kpi icon={ShoppingBag} label="Unidades/ticket" value={formatNumber(data.summary.unitsPerTicket)} />
            <Kpi
              icon={TrendingUp}
              label="Hora fuerte $"
              value={data.summary.bestHourByRevenue ?? "-"}
              tone="green"
            />
            <Kpi
              icon={Clock3}
              label="Hora fuerte tickets"
              value={data.summary.bestHourByTickets ?? "-"}
              tone="green"
            />
            <Kpi
              icon={CalendarDays}
              label="Dia fuerte $"
              value={data.summary.bestWeekdayByRevenue ?? "-"}
              tone="green"
            />
            <Kpi
              icon={CalendarDays}
              label="Dia fuerte tickets"
              value={data.summary.bestWeekdayByTickets ?? "-"}
              tone="green"
            />
          </div>

          <div className="product-insight-grid">
            <InsightPanel
              icon={BadgeDollarSign}
              title="Mas venta"
              empty="Sin ventas por hora en este periodo."
              rows={strongestSales.map((hour) => ({
                label: hour.label,
                value: formatCurrency(hour.revenue),
                detail: `${formatPercent(hour.share)} de venta - ${formatInteger(hour.tickets)} tickets`
              }))}
            />
            <InsightPanel
              icon={ReceiptText}
              title="Mas tickets"
              empty="Sin tickets por hora en este periodo."
              rows={strongestTickets.map((hour) => ({
                label: hour.label,
                value: formatInteger(hour.tickets),
                detail: `${formatPercent(hour.ticketShare)} de tickets - ${formatCurrency(hour.revenue)}`
              }))}
            />
            <InsightPanel
              icon={TrendingDown}
              title="Horas debiles"
              empty="Sin horas debiles visibles en este periodo."
              rows={weakHours.map((hour) => ({
                label: hour.label,
                value: formatCurrency(hour.revenue),
                detail: `${formatInteger(hour.tickets)} tickets - ${formatPercent(hour.share)} de venta`
              }))}
            />
          </div>

          <div className="product-insight-grid">
            <InsightPanel
              icon={CalendarDays}
              title="Dias fuertes por venta"
              empty="Sin ventas por dia de semana en este periodo."
              rows={strongestWeekdaySales.map((weekday) => ({
                label: weekday.label,
                value: formatCurrency(weekday.revenuePerDay),
                detail: `promedio por dia observado - total ${formatCurrency(weekday.revenue)}`
              }))}
            />
            <InsightPanel
              icon={ReceiptText}
              title="Dias fuertes por tickets"
              empty="Sin tickets por dia de semana en este periodo."
              rows={strongestWeekdayTickets.map((weekday) => ({
                label: weekday.label,
                value: formatNumber(weekday.ticketsPerDay),
                detail: `tickets/dia - total ${formatInteger(weekday.tickets)} tickets`
              }))}
            />
            <InsightPanel
              icon={TrendingDown}
              title="Dias debiles"
              empty="Sin dias debiles visibles en este periodo."
              rows={weakWeekdays.map((weekday) => ({
                label: weekday.label,
                value: formatCurrency(weekday.revenuePerDay),
                detail: `${formatNumber(weekday.ticketsPerDay)} tickets/dia - ${weekday.observedDays} dias medidos`
              }))}
            />
          </div>

          <section className="content-band">
            <div className="table-heading">
              <h2>Estado por dia de semana</h2>
              <span className="period-chip">comparacion por promedio diario</span>
            </div>
            {weekdays.length === 0 ? (
              <div className="dashed-empty">Sin ventas por dia de semana en este periodo.</div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table weekday-table">
                  <thead>
                    <tr>
                      <SortableTh<WeekdaySortKey>
                        label="Dia"
                        sortKey="label"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Venta total"
                        sortKey="revenue"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Venta/dia"
                        sortKey="revenuePerDay"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Tickets"
                        sortKey="tickets"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Tickets/dia"
                        sortKey="ticketsPerDay"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Ticket prom."
                        sortKey="averageTicket"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Part. $"
                        sortKey="share"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Dias medidos"
                        sortKey="observedDays"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                      <SortableTh<WeekdaySortKey>
                        label="Senal"
                        sortKey="signal"
                        sort={weekdaySort}
                        onSort={setWeekdaySort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWeekdays.map((weekday) => (
                      <tr key={weekday.weekday}>
                        <td>
                          <strong>{weekday.label}</strong>
                          <span className="cell-muted">{weekday.observedDays} dias observados</span>
                        </td>
                        <td>{formatCurrency(weekday.revenue)}</td>
                        <td>
                          {formatCurrency(weekday.revenuePerDay)}
                          <Meter value={weekday.share} max={100} />
                        </td>
                        <td>{formatInteger(weekday.tickets)}</td>
                        <td>{formatNumber(weekday.ticketsPerDay)}</td>
                        <td>{formatCurrency(weekday.averageTicket)}</td>
                        <td>{formatPercent(weekday.share)}</td>
                        <td>{weekday.observedDays}</td>
                        <td>
                          <span className={`signal-pill ${weekday.signalTone}`}>{weekday.signal}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <WeekdayHourMatrix data={data} />

          <section className="content-band">
            <div className="table-heading">
              <h2>Estado por horario</h2>
              <span className="period-chip">{periodLabel(mode, period.from, period.to)}</span>
            </div>
            {hours.length === 0 ? (
              <div className="dashed-empty">Sin ventas con hora en este periodo.</div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table hour-table">
                  <thead>
                    <tr>
                      <SortableTh<HourSortKey> label="Hora" sortKey="label" sort={sort} onSort={setSort} />
                      <SortableTh<HourSortKey> label="Venta" sortKey="revenue" sort={sort} onSort={setSort} />
                      <SortableTh<HourSortKey> label="Tickets" sortKey="tickets" sort={sort} onSort={setSort} />
                      <SortableTh<HourSortKey>
                        label="Ticket prom."
                        sortKey="averageTicket"
                        sort={sort}
                        onSort={setSort}
                      />
                      <SortableTh<HourSortKey> label="Unidades" sortKey="itemUnits" sort={sort} onSort={setSort} />
                      <SortableTh<HourSortKey>
                        label="Unid/ticket"
                        sortKey="unitsPerTicket"
                        sort={sort}
                        onSort={setSort}
                      />
                      <SortableTh<HourSortKey> label="Part. $" sortKey="share" sort={sort} onSort={setSort} />
                      <SortableTh<HourSortKey>
                        label="Part. tickets"
                        sortKey="ticketShare"
                        sort={sort}
                        onSort={setSort}
                      />
                      <SortableTh<HourSortKey>
                        label="Venta/dia"
                        sortKey="revenuePerDay"
                        sort={sort}
                        onSort={setSort}
                      />
                      <SortableTh<HourSortKey>
                        label="Tickets/dia"
                        sortKey="ticketsPerDay"
                        sort={sort}
                        onSort={setSort}
                      />
                      <SortableTh<HourSortKey> label="Senal" sortKey="signal" sort={sort} onSort={setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHours.map((hour) => (
                      <tr key={hour.hourKey}>
                        <td>
                          <strong>{hour.label}</strong>
                          <span className="cell-muted">{hour.daysWithSales} dias con venta</span>
                        </td>
                        <td>
                          {formatCurrency(hour.revenue)}
                          <Meter value={hour.share} max={100} />
                        </td>
                        <td>{formatInteger(hour.tickets)}</td>
                        <td>{formatCurrency(hour.averageTicket)}</td>
                        <td>{formatNumber(hour.itemUnits)}</td>
                        <td>{formatNumber(hour.unitsPerTicket)}</td>
                        <td>{formatPercent(hour.share)}</td>
                        <td>{formatPercent(hour.ticketShare)}</td>
                        <td>{formatCurrency(hour.revenuePerDay)}</td>
                        <td>{formatNumber(hour.ticketsPerDay)}</td>
                        <td>
                          <span className={`signal-pill ${hour.signalTone}`}>{hour.signal}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function SortableTh<TSortKey extends string>({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: TSortKey;
  sort: { key: TSortKey; direction: SortDirection };
  onSort: (value: { key: TSortKey; direction: SortDirection }) => void;
}) {
  const active = sort.key === sortKey;
  const direction = active ? sort.direction : "desc";
  return (
    <th>
      <button
        className={`sortable-header ${active ? "active" : ""}`}
        onClick={() => {
          onSort({
            key: sortKey,
            direction: active && sort.direction === "desc" ? "asc" : "desc"
          });
        }}
        type="button"
      >
        <span>{label}</span>
        {active ? <span className="sort-indicator">{direction === "desc" ? "↓" : "↑"}</span> : <ArrowUpDown size={13} />}
      </button>
    </th>
  );
}

function WeekdayHourMatrix({ data }: { data: HourPerformance }) {
  const hours = [...data.hours].sort((a, b) => a.hourKey.localeCompare(b.hourKey, "es-AR"));
  const weekdays = [...data.weekdays].sort((a, b) => weekdayOrder(a.weekday) - weekdayOrder(b.weekday));
  const maxRevenue = Math.max(1, ...data.weekdayHours.map((cell) => cell.revenue));
  const cellMap = new Map(
    data.weekdayHours.map((cell) => [`${cell.weekday}-${cell.hourKey}`, cell])
  );

  if (hours.length === 0 || weekdays.length === 0) {
    return (
      <section className="content-band">
        <h2>Mapa dia x hora</h2>
        <div className="dashed-empty">Sin datos suficientes para cruzar dias y horarios.</div>
      </section>
    );
  }

  return (
    <section className="content-band">
      <div className="table-heading">
        <h2>Mapa dia x hora</h2>
        <span className="period-chip">color por venta</span>
      </div>
      <div className="data-table-wrap">
        <table className="data-table matrix-table">
          <thead>
            <tr>
              <th>Dia</th>
              {hours.map((hour) => (
                <th key={hour.hourKey}>{hour.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((weekday) => (
              <tr key={weekday.weekday}>
                <td>
                  <strong>{weekday.label}</strong>
                  <span className="cell-muted">{formatCurrency(weekday.revenuePerDay)} / dia</span>
                </td>
                {hours.map((hour) => {
                  const cell = cellMap.get(`${weekday.weekday}-${hour.hourKey}`);
                  const intensity = cell ? Math.max(0.08, cell.revenue / maxRevenue) : 0;
                  return (
                    <td
                      className={cell ? "heat-cell" : "empty-heat-cell"}
                      key={`${weekday.weekday}-${hour.hourKey}`}
                      style={cell ? { backgroundColor: heatColor(intensity) } : undefined}
                    >
                      {cell ? (
                        <span>
                          <strong>{formatCurrency(cell.revenue)}</strong>
                          <small>{formatInteger(cell.tickets)} tickets</small>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HourPeriodControls({
  mode,
  selectedDate,
  selectedMonth,
  from,
  to,
  onMode,
  onDate,
  onMonth,
  onFrom,
  onTo
}: {
  mode: PeriodMode;
  selectedDate: string;
  selectedMonth: string;
  from: string;
  to: string;
  onMode: (value: PeriodMode) => void;
  onDate: (value: string) => void;
  onMonth: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="period-controls">
      <div className="control-tabs" aria-label="Modo de fechas">
        <button className={`mode-tab ${mode === "day" ? "active" : ""}`} onClick={() => onMode("day")} type="button">
          Dia
        </button>
        <button
          className={`mode-tab ${mode === "month" ? "active" : ""}`}
          onClick={() => onMode("month")}
          type="button"
        >
          Mes
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
          <button className="nav-button" onClick={() => onDate(shiftDate(selectedDate, -1))} type="button">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="date-display">
            <strong>{formatFullDate(selectedDate)}</strong>
            <input type="date" value={selectedDate} onChange={(event) => onDate(event.target.value)} />
          </div>
          <button className="nav-button" onClick={() => onDate(shiftDate(selectedDate, 1))} type="button">
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {mode === "month" ? (
        <div className="day-nav">
          <button className="nav-button" onClick={() => onMonth(shiftMonth(selectedMonth, -1))} type="button">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="date-display">
            <strong>{monthName(selectedMonth)}</strong>
            <input type="month" value={selectedMonth} onChange={(event) => onMonth(event.target.value)} />
          </div>
          <button className="nav-button" onClick={() => onMonth(shiftMonth(selectedMonth, 1))} type="button">
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {mode === "range" ? <DateFilters from={from} to={to} onFrom={onFrom} onTo={onTo} /> : null}
    </div>
  );
}

function DateFilters({
  from,
  to,
  onFrom,
  onTo
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
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

function InsightPanel({
  icon: Icon,
  title,
  rows,
  empty
}: {
  icon: React.ElementType;
  title: string;
  rows: Array<{ label: string; value: string; detail: string }>;
  empty: string;
}) {
  return (
    <section className="content-band compact-band">
      <h2>
        <Icon size={18} aria-hidden="true" />
        {title}
      </h2>
      {rows.length === 0 ? (
        <div className="dashed-empty">{empty}</div>
      ) : (
        <div className="list-stack">
          {rows.map((row) => (
            <div className="list-row horizontal-row" key={`${row.label}-${row.value}`}>
              <span>
                <strong>{row.label}</strong>
                <small>{row.detail}</small>
              </span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "red" | "blue" | "green" | "amber" | "slate";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <span className="mini-meter">
      <span className="mini-meter-fill sales" style={{ width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }} />
    </span>
  );
}

function periodRange(input: {
  mode: PeriodMode;
  selectedDate: string;
  selectedMonth: string;
  from: string;
  to: string;
}) {
  if (input.mode === "day") {
    return { from: input.selectedDate, to: input.selectedDate };
  }
  if (input.mode === "month") {
    return monthRange(input.selectedMonth);
  }
  return { from: input.from, to: input.to };
}

function dateQuery(from: string, to: string) {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
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

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${year}-${String(monthNumber).padStart(2, "0")}-${String(days).padStart(2, "0")}`
  };
}

function shiftDate(value: string, delta: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + delta);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function periodLabel(mode: PeriodMode, from: string, to: string) {
  if (mode === "day") return formatFullDate(from);
  if (mode === "month") return monthName(from.slice(0, 7));
  return `${from} al ${to}`;
}

function sortHours(hours: HourRow[], sort: { key: HourSortKey; direction: SortDirection }) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...hours].sort((a, b) => {
    const left = hourSortValue(a, sort.key);
    const right = hourSortValue(b, sort.key);
    const result =
      typeof left === "string" || typeof right === "string"
        ? String(left).localeCompare(String(right), "es-AR")
        : left - right;

    if (result !== 0) return result * direction;
    return a.hourKey.localeCompare(b.hourKey, "es-AR");
  });
}

function sortWeekdays(weekdays: WeekdayRow[], sort: { key: WeekdaySortKey; direction: SortDirection }) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...weekdays].sort((a, b) => {
    const left = weekdaySortValue(a, sort.key);
    const right = weekdaySortValue(b, sort.key);
    const result =
      typeof left === "string" || typeof right === "string"
        ? String(left).localeCompare(String(right), "es-AR")
        : left - right;

    if (result !== 0) return result * direction;
    return weekdayOrder(a.weekday) - weekdayOrder(b.weekday);
  });
}

function hourSortValue(hour: HourRow, key: HourSortKey) {
  const signalWeight: Record<HourRow["signalTone"], number> = {
    red: 4,
    amber: 3,
    green: 2,
    slate: 1
  };
  switch (key) {
    case "label":
      return hour.hourKey;
    case "revenue":
      return hour.revenue;
    case "tickets":
      return hour.tickets;
    case "averageTicket":
      return hour.averageTicket;
    case "itemUnits":
      return hour.itemUnits;
    case "unitsPerTicket":
      return hour.unitsPerTicket;
    case "share":
      return hour.share;
    case "ticketShare":
      return hour.ticketShare;
    case "revenuePerDay":
      return hour.revenuePerDay;
    case "ticketsPerDay":
      return hour.ticketsPerDay;
    case "signal":
      return signalWeight[hour.signalTone];
  }
}

function weekdaySortValue(weekday: WeekdayRow, key: WeekdaySortKey) {
  const signalWeight: Record<WeekdayRow["signalTone"], number> = {
    red: 4,
    amber: 3,
    green: 2,
    slate: 1
  };
  switch (key) {
    case "label":
      return weekdayOrder(weekday.weekday);
    case "revenue":
      return weekday.revenue;
    case "tickets":
      return weekday.tickets;
    case "averageTicket":
      return weekday.averageTicket;
    case "share":
      return weekday.share;
    case "ticketShare":
      return weekday.ticketShare;
    case "observedDays":
      return weekday.observedDays;
    case "revenuePerDay":
      return weekday.revenuePerDay;
    case "ticketsPerDay":
      return weekday.ticketsPerDay;
    case "signal":
      return signalWeight[weekday.signalTone];
  }
}

function weekdayOrder(value: number) {
  return value === 0 ? 7 : value;
}

function heatColor(intensity: number) {
  const alpha = Math.max(0.1, Math.min(0.88, intensity * 0.82));
  return `rgba(201, 18, 34, ${alpha})`;
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

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
}
