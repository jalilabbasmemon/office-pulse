"use client";

export function MonthFilter({
  name = "month",
  defaultValue,
}: {
  name?: string;
  defaultValue: string;
}) {
  return (
    <form method="get">
      <input
        type="month"
        name={name}
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </form>
  );
}

export function DateFilter({
  name = "date",
  defaultValue,
}: {
  name?: string;
  defaultValue: string;
}) {
  return (
    <form method="get">
      <input
        type="date"
        name={name}
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </form>
  );
}
