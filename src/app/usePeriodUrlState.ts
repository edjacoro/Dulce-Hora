import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type PeriodUrlMode = "day" | "month" | "range";

export function usePeriodUrlState<TMode extends PeriodUrlMode>(
  allowedModes: readonly TMode[],
  defaultMode: TMode
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayArgentina();
  const defaultMonth = today.slice(0, 7);
  const [mode, setModeState] = useState<TMode>(() => readMode(searchParams.get("mode"), allowedModes) ?? defaultMode);
  const [selectedDate, setSelectedDateState] = useState(() => readDate(searchParams.get("date")) ?? today);
  const [selectedMonth, setSelectedMonthState] = useState(
    () => readMonth(searchParams.get("month")) ?? (readDate(searchParams.get("date")) ?? today).slice(0, 7)
  );
  const [from, setFromState] = useState(() => readDate(searchParams.get("from")) ?? `${defaultMonth}-01`);
  const [to, setToState] = useState(() => readDate(searchParams.get("to")) ?? today);

  const writeSearch = useCallback(
    (next: Partial<{
      mode: TMode;
      selectedDate: string;
      selectedMonth: string;
      from: string;
      to: string;
    }>) => {
      const resolved = {
        mode,
        selectedDate,
        selectedMonth,
        from,
        to,
        ...next
      };
      const params = new URLSearchParams(searchParams);
      params.set("mode", resolved.mode);
      params.set("date", resolved.selectedDate);
      params.set("month", resolved.selectedMonth);
      params.set("from", resolved.from);
      params.set("to", resolved.to);
      setSearchParams(params, { replace: true });
    },
    [from, mode, searchParams, selectedDate, selectedMonth, setSearchParams, to]
  );

  const setMode = useCallback(
    (value: TMode) => {
      setModeState(value);
      writeSearch({ mode: value });
    },
    [writeSearch]
  );

  const setSelectedDate = useCallback(
    (value: string) => {
      setSelectedDateState(value);
      if (isDateInput(value)) {
        const month = value.slice(0, 7);
        setSelectedMonthState(month);
        writeSearch({ selectedDate: value, selectedMonth: month });
        return;
      }
      writeSearch({ selectedDate: value });
    },
    [writeSearch]
  );

  const setSelectedMonth = useCallback(
    (value: string) => {
      setSelectedMonthState(value);
      writeSearch({ selectedMonth: value });
    },
    [writeSearch]
  );

  const setFrom = useCallback(
    (value: string) => {
      setFromState(value);
      writeSearch({ from: value });
    },
    [writeSearch]
  );

  const setTo = useCallback(
    (value: string) => {
      setToState(value);
      writeSearch({ to: value });
    },
    [writeSearch]
  );

  return {
    mode,
    selectedDate,
    selectedMonth,
    from,
    to,
    setMode,
    setSelectedDate,
    setSelectedMonth,
    setFrom,
    setTo
  };
}

export function todayArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readMode<TMode extends PeriodUrlMode>(value: string | null, allowedModes: readonly TMode[]) {
  return allowedModes.includes(value as TMode) ? (value as TMode) : null;
}

function readDate(value: string | null) {
  return value && isDateInput(value) ? value : null;
}

function readMonth(value: string | null) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function isDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
