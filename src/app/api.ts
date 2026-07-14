export type ApiError = {
  error: string;
  details?: unknown;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    let payload: ApiError = { error: "No se pudo completar la solicitud" };
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      // Keep the generic message when the server did not return JSON.
    }
    throw new Error(payload.error);
  }

  return (await response.json()) as T;
}

export type SetupStatus = {
  required: boolean;
};

export type UserRole = "owner" | "administrator" | "manager" | "viewer";

export type SessionUser = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
};

export type Branch = {
  id: string;
  name: string;
  address: string | null;
  external_code: string | null;
  active: boolean;
  created_at: string;
};

export type MeResponse = {
  user: SessionUser;
  organization: {
    id: string;
    name: string;
    tax_id: string | null;
    currency: string;
    timezone: string;
    created_at: string;
  };
  branches: Branch[];
};

export type DashboardOverview = {
  counts: {
    branches: number;
    users: number;
    salesDocuments: number;
    saleItems: number;
    imports: number;
    syncRuns: number;
    products: number;
    wasteRecords: number;
  };
  dataStatus: string;
};

export type SalesDocument = {
  id: string;
  external_id: string;
  document_number: string | null;
  document_type: string;
  sale_date: string;
  sale_time: string | null;
  total: string;
  payment_method: string | null;
  status: string;
  source: string;
  imported_at: string;
  branch_name: string;
  item_count: string;
};

export type SalesSummary = {
  range: {
    from: string | null;
    to: string | null;
  };
  summary: {
    netSales: number;
    grossSales: number;
    documents: number;
    tickets: number;
    averageTicket: number;
    unitsPerTicket: number;
    coffeeCount: number;
  };
  byDate: Array<{ label: string; total: string; documents: string }>;
  byPayment: Array<{ label: string; total: string; documents: string }>;
  byHour: Array<{ label: string; total: string; documents: string }>;
  topProducts: Array<{ label: string; quantity: string; total: string }>;
};

export type WasteRecord = {
  id: string;
  date: string;
  quantity: string;
  unit_cost: string | null;
  total_cost: string | null;
  notes: string | null;
  source: string;
  external_id: string | null;
  external_event_id: string | null;
  user_name: string | null;
  product_name: string | null;
  category_name: string | null;
  branch_name: string;
};

export type WasteSummary = {
  range: {
    from: string | null;
    to: string | null;
  };
  summary: {
    totalCost: number;
    quantity: number;
    records: number;
    events: number;
    products: number;
  };
  byDate: Array<{ label: string; total: string; records: string; sales: string; wastePercent: number | null }>;
  topProducts: Array<{ label: string; category: string; quantity: string; total: string }>;
};

export type ProductPerformance = {
  range: {
    from: string | null;
    to: string | null;
  };
  summary: {
    revenue: number;
    quantitySold: number;
    tickets: number;
    soldProducts: number;
    totalProducts: number;
    wasteCost: number;
    wasteQuantity: number;
    wasteRate: number;
    topProduct: string | null;
  };
  products: Array<{
    productKey: string;
    label: string;
    category: string;
    quantitySold: number;
    revenue: number;
    tickets: number;
    wasteQuantity: number;
    wasteCost: number;
    wasteRecords: number;
    averageUnitPrice: number;
    share: number;
    wasteRate: number;
    wasteUnitRate: number;
    netAfterWaste: number;
    signal: string;
    signalTone: "green" | "amber" | "red" | "slate";
  }>;
};

export type HourPerformance = {
  range: {
    from: string | null;
    to: string | null;
  };
  summary: {
    revenue: number;
    documents: number;
    tickets: number;
    averageTicket: number;
    itemUnits: number;
    unitsPerTicket: number;
    activeDays: number;
    activeHours: number;
    bestHourByRevenue: string | null;
    bestHourByRevenueAmount: number;
    bestHourByTickets: string | null;
    bestHourByTicketsCount: number;
    bestWeekdayByRevenue: string | null;
    bestWeekdayByRevenueAmount: number;
    bestWeekdayByTickets: string | null;
    bestWeekdayByTicketsCount: number;
  };
  hours: Array<{
    hourKey: string;
    label: string;
    revenue: number;
    documents: number;
    tickets: number;
    averageTicket: number;
    itemUnits: number;
    unitsPerTicket: number;
    share: number;
    ticketShare: number;
    daysWithSales: number;
    revenuePerDay: number;
    ticketsPerDay: number;
    signal: string;
    signalTone: "green" | "amber" | "red" | "slate";
  }>;
  weekdays: Array<{
    weekday: number;
    label: string;
    shortLabel: string;
    revenue: number;
    documents: number;
    tickets: number;
    averageTicket: number;
    itemUnits: number;
    unitsPerTicket: number;
    share: number;
    ticketShare: number;
    observedDays: number;
    revenuePerDay: number;
    ticketsPerDay: number;
    signal: string;
    signalTone: "green" | "amber" | "red" | "slate";
  }>;
  weekdayHours: Array<{
    weekday: number;
    label: string;
    shortLabel: string;
    hourKey: string;
    hourLabel: string;
    revenue: number;
    tickets: number;
  }>;
};

export type FinanceDailyRow = {
  date: string;
  label: string;
  sales: number;
  tickets: number;
  averageTicket: number;
  expenses: number;
  waste: number;
  costs: number;
  result: number;
  future: boolean;
};

export type FinanceMonthRow = {
  month: string;
  sales: number;
  tickets: number;
  averageTicket: number;
  salesPerDay: number;
  ticketsPerDay: number;
  expenses: number;
  waste: number;
  costs: number;
  result: number;
  margin: number;
  daysWithSales: number;
  current: boolean;
};

export type FinanceDashboard = {
  month: string;
  date: string;
  credentialsConfigured: boolean;
  today: {
    sales: number;
    tickets: number;
    averageTicket: number;
    expenses: number;
    waste: number;
    costs: number;
    result: number;
    topProducts: Array<{ label: string; quantity: string; total: string }>;
    crossSelling: Array<{ product_a: string; product_b: string; tickets: string }>;
  };
  summary: {
    sales: number;
    expenses: number;
    waste: number;
    costs: number;
    result: number;
    margin: number;
    tickets: number;
    averageTicket: number;
    projection: number;
    bestMonth: string;
    bestMonthSales: number;
    monthCount: number;
  };
  monthlyRows: FinanceMonthRow[];
  dailyRows: FinanceDailyRow[];
  wasteTopProducts: Array<{ label: string; category: string; quantity: string; total: string }>;
  expenseCategories: Array<{ label: string; total: string; records: string }>;
  syncRuns: Array<{
    id: string;
    integration: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    records_received: number;
    records_created: number;
    records_updated: number;
    error_message: string | null;
    branch_name: string;
  }>;
};

export type CashflowDashboard = {
  month: string;
  range: {
    from: string;
    to: string;
  };
  rules: {
    efectivo: number;
    transferencias: number;
    posnet: number;
    cuentaDni: number;
    rappi: number;
    pedidosYa: number;
    pedidosYaPayout: string;
  };
  summary: {
    grossSales: number;
    immediateSales: number;
    portalPayouts: number;
    commissions: number;
    expensesPaid: number;
    expensesPending: number;
    withdrawals: number;
    netCash: number;
    closingBalance: number;
    pendingPortalPayouts: number;
  };
  dailyRows: Array<{
    date: string;
    label: string;
    grossSales: number;
    immediateSales: number;
    portalPayouts: number;
    commissions: number;
    expensesPaid: number;
    expensesPending: number;
    withdrawals: number;
    netCash: number;
    closingBalance: number;
  }>;
  channels: Array<{
    label: string;
    gross: number;
    commissions: number;
    netCash: number;
    documents: number;
  }>;
  pendingPayouts: Array<{
    date: string;
    provider: string;
    gross: number;
    net: number;
    commissions: number;
  }>;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  pnl_group: string;
};

export type ExpensePaymentType = "cash" | "bank" | "virtual" | "posnet" | "credit_card" | "deferred" | "other";

export type ExpenseRecord = {
  id: string;
  expense_date: string;
  accounting_month: string;
  supplier: string | null;
  description: string | null;
  amount: string;
  payment_method: string | null;
  payment_type: ExpensePaymentType;
  status: "paid" | "pending";
  deferred: boolean;
  paid_date: string | null;
  due_date: string | null;
  source: string;
  external_id: string | null;
  created_at: string;
  category_id: string | null;
  category_name: string;
  branch_name: string;
};

export type ExpensesResponse = {
  range: {
    from: string | null;
    to: string | null;
  };
  summary: {
    total: number;
    records: number;
    paid: number;
    pending: number;
    overdue: number;
    overdueRecords: number;
  };
  byCategory: Array<{ label: string; total: string; records: string }>;
  expenses: ExpenseRecord[];
};

export type InvestorRecord = {
  id: string;
  name: string;
  ownership_percent: string;
  active: boolean;
};

export type InvestorsResponse = {
  investors: InvestorRecord[];
};

export type ProfitWithdrawalRecord = {
  id: string;
  withdrawal_month: string;
  withdrawal_date: string;
  amount: string;
  status: "paid" | "pending";
  payment_method: string | null;
  notes: string | null;
  investor_id: string;
  investor_name: string;
  ownership_percent: string;
};

export type ProfitWithdrawalsResponse = {
  month: string;
  summary: {
    total: number;
    paid: number;
    pending: number;
    records: number;
  };
  withdrawals: ProfitWithdrawalRecord[];
};

export type ScheduleEmployee = {
  id: string;
  name: string;
  role: string | null;
  weeklyHours: number;
  monthlyNetSalary: number;
  monthlyGrossSalary: number | null;
  employerCost: number | null;
  photoUrl: string | null;
  onPayroll: boolean;
  hourlyCost: number;
  active: boolean;
  source: string;
  color: string;
};

export type EmployeeScheduleBlock = {
  weeks?: string;
  days: string;
  startTime: string;
  endTime: string;
};

export type EmployeeScheduleTemplate = {
  mode: "fixed" | "rotating" | "custom";
  label: string;
  rotation: "none" | "diego" | "vicky" | "mica" | "romi";
  fixedShifts: EmployeeScheduleBlock[];
  notes: string;
};

export type EmployeeRecord = ScheduleEmployee & {
  address: string | null;
  cuil: string | null;
  contactPhone: string | null;
  birthDate: string | null;
  age: number | null;
  ageRange: string;
  observations: string | null;
  scheduleTemplate: EmployeeScheduleTemplate;
};

export type EmployeesResponse = {
  employees: EmployeeRecord[];
  summary: {
    total: number;
    active: number;
    missingCuil: number;
    missingBirthDate: number;
  };
};

export type ScheduleShift = {
  id: string;
  date: string;
  weekday: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  hours: number;
  isHoliday: boolean;
  holidayName: string | null;
  isAbsence: boolean;
  notes: string | null;
  source: string;
  employeeId: string;
  employeeName: string;
  employeeColor: string;
  hourlyCost: number;
  estimatedCost: number;
};

export type ScheduleResponse = {
  month: string;
  range: {
    from: string;
    to: string;
  };
  branch: Branch;
  employees: ScheduleEmployee[];
  shifts: ScheduleShift[];
  employeeSummary: Array<{
    employeeId: string;
    employeeName: string;
    hours: number;
    holidayHours: number;
    absences: number;
    shifts: number;
    hourlyCost: number;
    estimatedCost: number;
  }>;
  dailySummary: Array<{
    date: string;
    weekday: string;
    hours: number;
    estimatedCost: number;
    people: number;
    holidays: number;
    absences: number;
  }>;
  holidays: Array<{
    id: string | null;
    date: string;
    name: string;
    kind: "holiday" | "closure";
    source: "national" | "manual";
    hours: number;
    people: number;
    estimatedCost: number;
    shiftCount: number;
    isSaturday: boolean;
    closesAt: string | null;
  }>;
  summary: {
    employees: number;
    shifts: number;
    hours: number;
    holidayHours: number;
    absences: number;
    estimatedCost: number;
  };
};
