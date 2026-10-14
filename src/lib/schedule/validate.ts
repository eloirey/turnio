import { DEFAULT_RULES, DEFAULT_SHIFTS } from "./defaults";
import { isAbsent } from "./generator";
import { nightRunViolations, restViolations } from "./rules";
import type { AbsenceMap, Demand, Employee, Gap, Grid, Issue, Rules, ShiftCatalog, Slot } from "./types";

/** Plazas de la demanda que el cuadrante actual no cubre. */
export function findGaps(grid: Grid, employees: Employee[], demand: Demand): Gap[] {
  const gaps: Gap[] = [];
  demand.forEach((dayDemand, day) => {
    for (const slot of Object.keys(dayDemand) as Slot[]) {
      for (const [role, needed] of Object.entries(dayDemand[slot] ?? {})) {
        if (!needed) continue;
        const have = employees.filter((e) => e.role === role && grid[e.id]?.[day] === slot).length;
        if (have < needed) gaps.push({ day, slot, role, missing: needed - have });
      }
    }
  });
  return gaps;
}

/** Horas asignadas a cada empleado en la semana. */
export function hoursByEmployee(grid: Grid, employees: Employee[], shifts: ShiftCatalog = DEFAULT_SHIFTS) {
  const result: Record<string, number> = {};
  for (const e of employees) {
    result[e.id] = (grid[e.id] ?? []).reduce((acc, c) => acc + (c === "L" ? 0 : shifts[c].hours), 0);
  }
  return result;
}

/** Problemas por empleado: reglas laborales, ausencias, disponibilidad y horas de más. */
export function findIssues(
  grid: Grid,
  employees: Employee[],
  shifts: ShiftCatalog = DEFAULT_SHIFTS,
  rules: Rules = DEFAULT_RULES,
  absences: AbsenceMap = {},
): Issue[] {
  const issues: Issue[] = [];
  const hours = hoursByEmployee(grid, employees, shifts);

  for (const e of employees) {
    const row = grid[e.id] ?? [];

    const conflicts = row.flatMap((c, d) => (c !== "L" && isAbsent(absences, e.id, d) ? [d] : []));
    if (conflicts.length) issues.push({ kind: "absence-conflict", employeeId: e.id, days: conflicts });

    const rest = restViolations(row, shifts, rules.minRestHours);
    if (rest.length) issues.push({ kind: "short-rest", employeeId: e.id, days: [...new Set(rest)] });

    const nights = nightRunViolations(row, rules.maxConsecutiveNights);
    if (nights.length) issues.push({ kind: "consecutive-nights", employeeId: e.id, days: nights });

    const outside = row.flatMap((c, d) => (c !== "L" && !isAbsent(absences, e.id, d) && !e.availability[c][d] ? [d] : []));
    if (outside.length) issues.push({ kind: "outside-availability", employeeId: e.id, days: outside });

    const daysOff = row.filter((c) => c === "L").length;
    if (daysOff < rules.minDaysOff) issues.push({ kind: "too-few-days-off", employeeId: e.id, days: [] });

    if (hours[e.id] > e.contractHours) issues.push({ kind: "over-contract", employeeId: e.id, days: [] });
  }
  return issues;
}
