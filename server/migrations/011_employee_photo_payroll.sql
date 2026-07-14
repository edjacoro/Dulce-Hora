alter table employees
  add column if not exists photo_url text;

alter table employees
  add column if not exists on_payroll boolean not null default false;

update employees
set on_payroll = true,
    employer_cost = round(monthly_gross_salary * 1.35, 2)
where monthly_gross_salary is not null
  and monthly_gross_salary > 0;
