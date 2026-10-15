import { DEFAULT_RULES, DEFAULT_SHIFTS } from "./defaults";
import { codeHours, isClosing, rowIsValid, rulesFor } from "./rules";
import {
  DAYS_IN_WEEK,
  FREE,
  type AbsenceMap,
  type Demand,
  type Employee,
  type Grid,
  type Rules,
  type ShiftCatalog,
  type Slot,
} from "./types";

interface Need {
  day: number;
  slot: Slot;
  role: string;
}

export function emptyGrid(employees: Employee[]): Grid {
  const grid: Grid = {};
  for (const e of employees) grid[e.id] = Array(DAYS_IN_WEEK).fill(FREE);
  return grid;
}

/** Convierte la demanda en una lista plana de "plazas" a cubrir (una por persona). */
function expandDemand(demand: Demand, shifts?: ShiftCatalog): Need[] {
  const needs: Need[] = [];
  demand.forEach((dayDemand, day) => {
    for (const slot of Object.keys(dayDemand)) {
      if (shifts && !shifts[slot]?.active) continue; // franja archivada o inexistente
      for (const [role, count] of Object.entries(dayDemand[slot] ?? {})) {
        for (let k = 0; k < count; k++) needs.push({ day, slot, role });
      }
    }
  });
  return needs;
}

export function isAbsent(absences: AbsenceMap, employeeId: string, day: number): boolean {
  return Boolean(absences[employeeId]?.[day]);
}

/** Número pseudoaleatorio estable a partir de un texto (para desempates reproducibles). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface Strategy {
  /** Prefiere que cada persona siga en la misma franja que el día de al lado. */
  continuity: boolean;
  /** null = sin desempate aleatorio; un número = variante reproducible. */
  seed: number | null;
}

/**
 * Generador de cuadrantes.
 *
 * Hace varias pasadas "voraces" con estrategias distintas y se queda con la
 * mejor: la que deja menos huecos y, a igualdad, la que reparte las horas de
 * forma más justa. Siempre da el mismo resultado para los mismos datos.
 *
 * En cada pasada:
 *  1. Lista todas las plazas a cubrir (expandDemand).
 *  2. Las ordena de MÁS DIFÍCIL a más fácil: primero las que menos empleados
 *     pueden cubrir. Si dejáramos para el final una plaza que solo puede
 *     cubrir una persona, quizá esa persona ya estaría llena.
 *  3. Para cada plaza elige, entre los candidatos válidos, por este orden:
 *     - quien no tenga que hacer horas extra para cubrirla;
 *     - quien no prefiera librar ese día;
 *     - quien no tenga que cambiar de franja respecto al día de al lado;
 *     - quien lleve menos horas en proporción a su contrato;
 *     - quien lleve menos cierres y menos fines de semana (reparto justo).
 *
 * Un candidato es válido si: tiene el puesto, está disponible, no está de
 * ausencia, ese día aún libra, no supera su contrato más las horas extra
 * permitidas y no rompe ninguna regla (las suyas o las del local).
 *
 * Las plazas que no se pueden cubrir quedan como huecos que el validador avisa.
 */
export function generateSchedule(
  employees: Employee[],
  demand: Demand,
  shifts: ShiftCatalog = DEFAULT_SHIFTS,
  rules: Rules = DEFAULT_RULES,
  absences: AbsenceMap = {},
): Grid {
  const strategies: Strategy[] = [
    { continuity: false, seed: null },
    { continuity: true, seed: null },
    ...Array.from({ length: 12 }, (_, i) => ({ continuity: i % 2 === 0, seed: i + 1 })),
  ];
  let best: { grid: Grid; score: number } | null = null;
  for (const strategy of strategies) {
    const { grid, missing } = greedy(employees, demand, shifts, rules, absences, strategy);
    const score = missing * 1000 + unfairness(grid, employees, shifts);
    if (!best || score < best.score - 1e-9) best = { grid, score };
    if (missing === 0 && strategy.seed === null && strategy.continuity === false && score < 1e-9) break;
  }
  return best!.grid;
}

/** Cuánto se separa cada persona del reparto medio (horas asignadas / contrato). */
function unfairness(grid: Grid, employees: Employee[], shifts: ShiftCatalog): number {
  if (employees.length === 0) return 0;
  const ratios = employees.map((e) => grid[e.id].reduce((a, c) => a + codeHours(c, shifts), 0) / Math.max(1, e.contractHours));
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return ratios.reduce((a, r) => a + Math.abs(r - mean), 0);
}

function greedy(
  employees: Employee[],
  demand: Demand,
  shifts: ShiftCatalog,
  rules: Rules,
  absences: AbsenceMap,
  strategy: Strategy,
): { grid: Grid; missing: number } {
  const grid = emptyGrid(employees);
  const hours = new Map(employees.map((e) => [e.id, 0]));
  const closings = new Map(employees.map((e) => [e.id, 0]));
  const weekends = new Map(employees.map((e) => [e.id, 0]));
  const personal = new Map(employees.map((e) => [e.id, rulesFor(e, rules)]));
  const extra = Math.max(0, rules.maxExtraHours ?? 0);
  const noise = (key: string) => (strategy.seed === null ? 0 : hash(`${strategy.seed}:${key}`));

  const canWorkAtAll = (e: Employee, n: Need) =>
    e.role === n.role && e.availability[n.slot]?.[n.day] === true && !isAbsent(absences, e.id, n.day);

  const needs = expandDemand(demand, shifts);
  const eligibleCount = new Map(needs.map((n) => [n, employees.filter((e) => canWorkAtAll(e, n)).length]));
  needs.forEach((n, i) => ((n as Need & { k: number }).k = i));
  needs.sort(
    (a, b) =>
      eligibleCount.get(a)! - eligibleCount.get(b)! ||
      noise(`n${(a as Need & { k: number }).k}`) - noise(`n${(b as Need & { k: number }).k}`) ||
      a.day - b.day,
  );

  let missing = 0;
  for (const need of needs) {
    const shiftHours = codeHours(need.slot, shifts);
    const candidates = employees.filter((e) => {
      if (!canWorkAtAll(e, need)) return false;
      if (grid[e.id][need.day] !== FREE) return false;
      if (hours.get(e.id)! + shiftHours > e.contractHours + extra) return false;
      const row = [...grid[e.id]];
      row[need.day] = need.slot;
      return rowIsValid(row, shifts, personal.get(e.id)!);
    });
    if (candidates.length === 0) {
      missing++;
      continue; // queda como hueco
    }

    const overtime = (e: Employee) => (hours.get(e.id)! + shiftHours > e.contractHours ? 1 : 0);
    const prefersOff = (e: Employee) => (e.preferredDaysOff?.includes(need.day) ? 1 : 0);
    // Cambiar de franja de un día a otro (mañana → tarde → mañana) gasta descanso
    // y deja huecos imposibles más adelante: mejor quien mantiene su franja.
    const switches = (e: Employee) =>
      [need.day - 1, need.day + 1].filter((d) => d >= 0 && d < DAYS_IN_WEEK && grid[e.id][d] !== FREE && grid[e.id][d] !== need.slot).length;
    const continues = (e: Employee) =>
      strategy.continuity ? [need.day - 1, need.day + 1].filter((d) => d >= 0 && d < DAYS_IN_WEEK && grid[e.id][d] === need.slot).length : 0;
    candidates.sort(
      (a, b) =>
        overtime(a) - overtime(b) ||
        prefersOff(a) - prefersOff(b) ||
        switches(a) - switches(b) ||
        continues(b) - continues(a) ||
        hours.get(a.id)! / a.contractHours - hours.get(b.id)! / b.contractHours ||
        closings.get(a.id)! - closings.get(b.id)! ||
        weekends.get(a.id)! - weekends.get(b.id)! ||
        noise(`${a.id}:${need.day}:${need.slot}`) - noise(`${b.id}:${need.day}:${need.slot}`),
    );
    const chosen = candidates[0];
    grid[chosen.id][need.day] = need.slot;
    hours.set(chosen.id, hours.get(chosen.id)! + shiftHours);
    if (isClosing(need.slot, shifts)) closings.set(chosen.id, closings.get(chosen.id)! + 1);
    if (need.day >= 5) weekends.set(chosen.id, weekends.get(chosen.id)! + 1);
  }

  return { grid, missing };
}
