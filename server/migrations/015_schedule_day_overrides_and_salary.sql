alter table schedule_holidays
  add column if not exists kind text not null default 'holiday';

alter table schedule_holidays
  add column if not exists close_at time;

alter table schedule_holidays
  drop constraint if exists schedule_holidays_kind_check;

alter table schedule_holidays
  add constraint schedule_holidays_kind_check
  check (kind in ('holiday', 'closure'));

update employees
set monthly_gross_salary = case
      when on_payroll then round(monthly_net_salary * 0.35, 2)
      else 0
    end,
    employer_cost = round(monthly_net_salary + case
      when on_payroll then monthly_net_salary * 0.35
      else 0
    end, 2)
where monthly_net_salary is not null;
