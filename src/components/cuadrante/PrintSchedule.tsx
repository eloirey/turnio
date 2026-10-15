"use client";

import { ABSENCE_LABELS, type AbsenceReason } from "@/lib/data/mappers";
import { DAY_LONG, DAY_SHORT, dayOfMonth, isoWeekNumber, weekRangeLabel } from "@/lib/dates";
import { roleMap, roleStyle, type Role } from "@/lib/roles";
import { shiftTimes } from "@/lib/schedule/rules";
import { FREE, type AbsenceMap, type Grid, type ShiftCatalog } from "@/lib/schedule/types";
import type { CuadranteEmployee } from "./Cuadrante";

/** Cuadrante para imprimir y colgar en el tablón: una tabla que ocupa el ancho del papel. */
export function PrintSchedule(props: {
  title: string;
  monday: string;
  employees: CuadranteEmployee[];
  roles: Role[];
  grid: Grid;
  shifts: ShiftCatalog;
  absences: AbsenceMap;
  hours: Record<string, number>;
}) {
  const { title, monday, employees, roles, grid, shifts, absences, hours } = props;
  const roleById = roleMap(roles);
  return (
    <div className="hidden text-ink print:block">
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <div className="text-[9pt] uppercase tracking-[0.08em] text-ink-muted">
            {title ? `${title} · ` : ""}Semana {isoWeekNumber(monday)}
          </div>
          <h1 className="font-display text-[18pt] font-bold leading-tight">{weekRangeLabel(monday)}</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-3 text-[8.5pt]">
          {roles.map((r) => (
            <span key={r.key} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: roleStyle(r.color).backgroundColor }} />
              {r.name}
            </span>
          ))}
        </div>
      </div>
      <table className="w-full table-fixed border-collapse text-[9.5pt] leading-tight">
        <colgroup>
          <col style={{ width: "15%" }} />
          {DAY_SHORT.map((d) => (
            <col key={d} />
          ))}
          <col style={{ width: "6%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-line px-1.5 py-1 text-left">Persona</th>
            {DAY_SHORT.map((d, i) => (
              <th key={d} className="border border-line px-1.5 py-1 text-center">
                {DAY_LONG[i]} {dayOfMonth(monday, i)}
              </th>
            ))}
            <th className="border border-line px-1.5 py-1 text-center">Horas</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const color = roleStyle(roleById[e.role]?.color);
            return (
              <tr key={e.id} className="break-inside-avoid">
                <td className="border border-line px-1.5 py-1.5">
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-[8pt] text-ink-muted">{roleById[e.role]?.name ?? e.role}</div>
                </td>
                {(grid[e.id] ?? []).map((c, d) => {
                  const s = c !== FREE ? shifts[c] : undefined;
                  const away = absences[e.id]?.[d] as AbsenceReason | null | undefined;
                  return (
                    <td key={d} className="border border-line px-1.5 py-1.5 text-center" style={s ? color : undefined}>
                      {s ? (
                        <>
                          <div className="font-semibold">{shiftTimes(s)}</div>
                          <div className="truncate text-[8pt]">{s.label}</div>
                        </>
                      ) : away ? (
                        <span className="italic text-ink-muted">{ABSENCE_LABELS[away]}</span>
                      ) : (
                        <span className="text-ink-muted/60">Libre</span>
                      )}
                    </td>
                  );
                })}
                <td className="border border-line px-1.5 py-1 text-center font-semibold">{hours[e.id] ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1.5 text-right text-[7.5pt] text-ink-muted">Cada persona tiene su horario siempre al día en su enlace personal · Rotafy</div>
    </div>
  );
}
