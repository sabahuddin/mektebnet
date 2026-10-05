import { useLanguage } from "@/context/language";

export function HomeworkGroupPicker({
  groups, selectedIds, onChange, disabled, currentGroupName, copyOnly,
}: {
  groups: { id: number; naziv: string }[];
  selectedIds: Set<number>;
  onChange: (ids: Set<number>) => void;
  disabled: boolean;
  currentGroupName?: string;
  copyOnly: boolean;
}) {
  const { t } = useLanguage();
  return (
    <fieldset disabled={disabled} className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
      <legend className="px-1 text-sm font-bold text-foreground">
        {copyOnly ? t("Odaberi druge grupe") : t("Dodaj istu zadaću i drugim grupama")}
      </legend>
      <p className="mb-3 text-xs text-muted-foreground">
        {copyOnly
          ? t("Izvorna zadaća ostaje nepromijenjena. Odaberi najmanje jednu grupu za novu dodjelu.")
          : `${t("Zadaću dobija odabrana grupa:")} ${currentGroupName ?? ""}. ${t("Druge grupe su opcionalne.")}`}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map(group => (
          <label key={group.id} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={selectedIds.has(group.id)}
              data-testid={`homework-extra-group-${group.id}`}
              className="h-4 w-4 shrink-0 accent-emerald-600"
              onChange={event => {
                const next = new Set(selectedIds);
                if (event.target.checked) next.add(group.id);
                else next.delete(group.id);
                onChange(next);
              }}
            />
            <span className="min-w-0 break-words text-sm font-medium">{group.naziv}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
