import { describe, expect, it } from "vitest";
import { makeRoleKey } from "../roles";
import { DEMO_DEMAND, DEMO_EMPLOYEES } from "./demo-data";
import {
  DEFAULT_RULES,
  DEFAULT_SHIFTS,
  findGaps,
  findIssues,
  generateSchedule,
  hoursByEmployee,
  nightRunViolations,
  restViolations,
  rowIsValid,
  shiftWindow,
  type Code,
  type ShiftCatalog,
} from "./index";
import { customShifts, getTemplate, SECTOR_TEMPLATES, templateDemand, templateRoles, templateShifts, templateTeam } from "./templates";
import type { Employee } from "./types";

describe("reglas: noches seguidas", () => {
  it("detecta 3 noches seguidas cuando el máximo es 2", () => {
    expect(nightRunViolations(["L", "N", "N", "N", "L", "L", "L"], 2, DEFAULT_SHIFTS).sort()).toEqual([1, 2, 3]);
  });
  it("acepta 2 noches seguidas", () => {
    expect(nightRunViolations(["N", "N", "L", "N", "N", "L", "L"], 2, DEFAULT_SHIFTS)).toEqual([]);
  });
  it("detecta una racha al final de la semana", () => {
    expect(nightRunViolations(["L", "L", "L", "L", "N", "N", "N"], 2, DEFAULT_SHIFTS).sort()).toEqual([4, 5, 6]);
  });
});

describe("reglas: descanso mínimo entre jornadas (12 h)", () => {
  it("calcula franjas que cruzan la medianoche", () => {
    expect(shiftWindow(0, "N", DEFAULT_SHIFTS)).toEqual({ start: 17, end: 25 });
  });
  it("noche (hasta la 01:00) y mañana (09:00) = 8 h: no cumple", () => {
    expect(restViolations(["N", "M", "L", "L", "L", "L", "L"], DEFAULT_SHIFTS, 12)).toEqual([0, 1]);
  });
  it("noche y tarde (13:00) = 12 h justas: cumple", () => {
    expect(restViolations(["N", "T", "L", "L", "L", "L", "L"], DEFAULT_SHIFTS, 12)).toEqual([]);
  });
  it("usa los horarios del local, no reglas fijas", () => {
    const late: ShiftCatalog = { ...DEFAULT_SHIFTS, T: { ...DEFAULT_SHIFTS.T, start: "15:00", end: "23:30" } };
    // tarde hasta las 23:30 y mañana a las 09:00 = 9,5 h
    expect(restViolations(["T", "M", "L", "L", "L", "L", "L"], late, 12)).toEqual([0, 1]);
    expect(restViolations(["T", "M", "L", "L", "L", "L", "L"], DEFAULT_SHIFTS, 12)).toEqual([]);
  });
});

describe("reglas: días libres", () => {
  it("6 días trabajados no cumple con 2 libres mínimos", () => {
    expect(rowIsValid(["M", "M", "M", "M", "M", "M", "L"], DEFAULT_SHIFTS, DEFAULT_RULES)).toBe(false);
    expect(rowIsValid(["M", "M", "M", "M", "M", "L", "L"], DEFAULT_SHIFTS, DEFAULT_RULES)).toBe(true);
  });
});

describe("generador con la plantilla de ejemplo", () => {
  const grid = generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND);

  it("asigna 7 casillas por persona", () => {
    for (const e of DEMO_EMPLOYEES) expect(grid[e.id]).toHaveLength(7);
  });

  it("nunca asigna fuera de la disponibilidad", () => {
    for (const e of DEMO_EMPLOYEES) grid[e.id].forEach((c, d) => c !== "L" && expect(e.availability[c][d]).toBe(true));
  });

  it("solo asigna turnos de su puesto que se necesitan", () => {
    for (const e of DEMO_EMPLOYEES)
      grid[e.id].forEach((c, d) => c !== "L" && expect(DEMO_DEMAND[d][c]?.[e.role] ?? 0).toBeGreaterThan(0));
  });

  it("nunca supera las horas de contrato", () => {
    const hours = hoursByEmployee(grid, DEMO_EMPLOYEES);
    for (const e of DEMO_EMPLOYEES) expect(hours[e.id]).toBeLessThanOrEqual(e.contractHours);
  });

  it("no genera ningún conflicto con las reglas laborales", () => {
    expect(findIssues(grid, DEMO_EMPLOYEES, DEFAULT_SHIFTS, DEFAULT_RULES)).toEqual([]);
  });

  it("no cubre más plazas de las necesarias", () => {
    for (let d = 0; d < 7; d++)
      for (const slot of ["M", "T", "N"] as const)
        for (const role of ["sala", "cocina", "barra"]) {
          const n = DEMO_EMPLOYEES.filter((e) => e.role === role && grid[e.id][d] === slot).length;
          expect(n).toBeLessThanOrEqual(DEMO_DEMAND[d][slot]?.[role] ?? 0);
        }
  });

  it("es determinista", () => {
    expect(generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND)).toEqual(grid);
  });

  it("deja como hueco la barra que nadie puede cubrir sin romper reglas", () => {
    const gaps = findGaps(grid, DEMO_EMPLOYEES, DEMO_DEMAND);
    const weekdayBarra = gaps.filter((g) => g.role === "barra" && g.slot === "N" && g.day >= 1 && g.day <= 3);
    expect(weekdayBarra.reduce((a, g) => a + g.missing, 0)).toBe(1);
  });
});

describe("ausencias", () => {
  it("el generador no asigna a quien está de vacaciones", () => {
    const absences = { marta: ["vacaciones", "vacaciones", "vacaciones", null, null, null, null] };
    const grid = generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND, DEFAULT_SHIFTS, DEFAULT_RULES, absences);
    expect(grid.marta.slice(0, 3)).toEqual(["L", "L", "L"]);
  });

  it("el validador avisa si se asigna un turno en un día de ausencia", () => {
    const grid = generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND);
    grid.jordi = ["M", "L", "L", "L", "L", "L", "L"];
    const issues = findIssues(grid, DEMO_EMPLOYEES, DEFAULT_SHIFTS, DEFAULT_RULES, { jordi: ["baja", null, null, null, null, null, null] });
    expect(issues).toContainEqual({ kind: "absence-conflict", employeeId: "jordi", days: [0] });
  });
});

describe("validador", () => {
  it("avisa de horas de más, disponibilidad, descanso corto y pocos días libres", () => {
    const grid = generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND);
    grid.aleix = ["N", "M", "L", "N", "N", "N", "N"] as Code[]; // 48 h, noche→mañana, 1 libre
    grid.marta = [...grid.marta];
    grid.marta[6] = "M"; // Marta no está disponible el domingo
    const kinds = findIssues(grid, DEMO_EMPLOYEES).map((i) => `${i.employeeId}:${i.kind}`);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "aleix:over-contract",
        "aleix:short-rest",
        "aleix:too-few-days-off",
        "aleix:consecutive-nights",
        "marta:outside-availability",
      ]),
    );
  });
});

describe("plantillas y puestos", () => {
  it("cada plantilla trae puestos, franjas, necesidades y un equipo que las cubre", () => {
    for (const t of SECTOR_TEMPLATES) {
      const roles = templateRoles(t);
      const shifts = templateShifts(t);
      const demand = templateDemand(t, roles);
      const team = templateTeam(t, roles);
      expect(roles.length, t.key).toBeGreaterThan(0);
      expect(Object.keys(shifts).length, t.key).toBeLessThanOrEqual(8);
      expect(Object.keys(shifts), t.key).not.toContain("L");
      for (const s of Object.values(shifts)) expect(s.label.length, t.key).toBeLessThanOrEqual(30);
      const grid = generateSchedule(team, demand, shifts, DEFAULT_RULES);
      const missing = findGaps(grid, team, demand, shifts).reduce((a, g) => a + g.missing, 0);
      expect(missing, `${t.key}: huecos`).toBeLessThanOrEqual(1);
      expect(findIssues(grid, team, shifts, DEFAULT_RULES), t.key).toEqual([]);
    }
  });

  it("un puesto añadido a mano recibe una necesidad básica", () => {
    const t = SECTOR_TEMPLATES[0];
    const roles = templateRoles(t, ["Sala", "Cocina", "Barra", "Terraza"]);
    const demand = templateDemand(t, roles);
    expect(demand[0][t.shifts[0].code]?.terraza).toBe(1);
    expect(demand[6][t.shifts[0].code]?.terraza).toBeUndefined();
  });

  it("crea claves de puesto únicas y sin tildes", () => {
    expect(makeRoleKey("Atención al cliente", [])).toBe("atencion-al-cliente");
    expect(makeRoleKey("Sala", ["sala"])).toBe("sala-2");
    expect(makeRoleKey("Sala", ["sala", "sala-2"])).toBe("sala-3");
    expect(makeRoleKey("¡¡!!", [])).toBe("puesto");
  });
});

// ---------- Franjas libres y reglas por persona ----------
const BUS: ShiftCatalog = {
  L12: { code: "L12", label: "Línea 12", start: "06:00", end: "14:00", hours: 8, closing: false, order: 0, active: true },
  L7: { code: "L7", label: "Línea 7", start: "14:00", end: "22:00", hours: 8, closing: false, order: 1, active: true },
  BUHO: { code: "BUHO", label: "Búho", start: "22:30", end: "06:30", hours: 8, closing: true, order: 2, active: true },
  OLD: { code: "OLD", label: "Antigua", start: "08:00", end: "16:00", hours: 8, closing: false, order: 3, active: false },
};
const all7 = () => Array(7).fill(true);
const driver = (id: string, extra: Partial<Employee> = {}): Employee => ({
  id,
  name: id,
  role: "conductores",
  contractHours: 40,
  availability: { L12: all7(), L7: all7(), BUHO: all7(), OLD: all7() },
  ...extra,
});

describe("franjas con nombre propio", () => {
  it("genera con códigos de varias letras y respeta el descanso entre ellas", () => {
    const demand = Array.from({ length: 7 }, () => ({ L12: { conductores: 1 }, L7: { conductores: 1 } }));
    const team = ["a", "b", "c"].map((id) => driver(id));
    const grid = generateSchedule(team, demand, BUS, DEFAULT_RULES);
    expect(findGaps(grid, team, demand, BUS)).toEqual([]);
    expect(findIssues(grid, team, BUS, DEFAULT_RULES)).toEqual([]);
  });

  it("los cierres son las franjas marcadas como cierre, se llamen como se llamen", () => {
    expect(nightRunViolations(["BUHO", "BUHO", "BUHO", "L", "L", "L", "L"], 2, BUS)).toEqual([0, 1, 2]);
    expect(nightRunViolations(["L7", "L7", "L7", "L7", "L", "L", "L"], 2, BUS)).toEqual([]);
  });

  it("no usa franjas archivadas aunque sigan en la demanda", () => {
    const demand = [{ OLD: { conductores: 1 } }, {}, {}, {}, {}, {}, {}];
    const team = [driver("a")];
    const grid = generateSchedule(team, demand, BUS, DEFAULT_RULES);
    expect(grid.a).toEqual(["L", "L", "L", "L", "L", "L", "L"]);
    expect(findGaps(grid, team, demand, BUS)).toEqual([]);
  });

  it("una casilla con una franja que ya no existe cuenta 0 horas y no rompe nada", () => {
    const team = [driver("a")];
    expect(hoursByEmployee({ a: ["ZZZ", "L", "L", "L", "L", "L", "L"] }, team, BUS).a).toBe(0);
    expect(() => findIssues({ a: ["ZZZ", "L12", "L", "L", "L", "L", "L"] }, team, BUS, DEFAULT_RULES)).not.toThrow();
  });
});

describe("reglas de cada persona", () => {
  const demand = Array.from({ length: 7 }, () => ({ L12: { conductores: 1 } }));

  it("respeta los días libres propios", () => {
    const team = [driver("a", { minDaysOff: 4 }), driver("b")];
    const grid = generateSchedule(team, demand, BUS, DEFAULT_RULES);
    expect(grid.a.filter((c) => c === "L").length).toBeGreaterThanOrEqual(4);
    expect(findIssues(grid, team, BUS, DEFAULT_RULES)).toEqual([]);
  });

  it("avisa si a mano se le quitan días libres propios", () => {
    const team = [driver("a", { minDaysOff: 3 })];
    const issues = findIssues({ a: ["L12", "L12", "L12", "L12", "L12", "L", "L"] }, team, BUS, DEFAULT_RULES);
    expect(issues.map((i) => i.kind)).toContain("too-few-days-off");
  });

  it("respeta los cierres seguidos propios", () => {
    const team = [driver("a", { maxConsecutiveClosings: 1 })];
    const issues = findIssues({ a: ["BUHO", "BUHO", "L", "L", "L", "L", "L"] }, team, BUS, { ...DEFAULT_RULES, minRestHours: 0 });
    expect(issues.map((i) => i.kind)).toContain("consecutive-nights");
  });

  it("intenta dar libre los días que cada uno prefiere", () => {
    const team = [driver("a", { preferredDaysOff: [5, 6] }), driver("b", { preferredDaysOff: [0, 1] })];
    const grid = generateSchedule(team, demand, BUS, DEFAULT_RULES);
    expect(grid.a[5]).toBe("L");
    expect(grid.a[6]).toBe("L");
    expect(grid.b[0]).toBe("L");
    expect(grid.b[1]).toBe("L");
  });

  it("solo usa horas extra si hacen falta y si el local las permite", () => {
    const team = [driver("a", { contractHours: 24 })];
    const short = Array.from({ length: 7 }, (_, d) => (d < 4 ? { L12: { conductores: 1 } } : {}));
    expect(generateSchedule(team, short, BUS, DEFAULT_RULES).a.filter((c) => c !== "L")).toHaveLength(3);
    const withExtra = generateSchedule(team, short, BUS, { ...DEFAULT_RULES, maxExtraHours: 8 });
    expect(withExtra.a.filter((c) => c !== "L")).toHaveLength(4);
    expect(findIssues(withExtra, team, BUS, { ...DEFAULT_RULES, maxExtraHours: 8 })).toEqual([]);
    expect(findIssues(withExtra, team, BUS, DEFAULT_RULES).map((i) => i.kind)).toContain("over-contract");
  });

  it("da siempre el mismo cuadrante para los mismos datos", () => {
    const t = SECTOR_TEMPLATES[0];
    const roles = templateRoles(t);
    const args = [templateTeam(t, roles), templateDemand(t, roles), templateShifts(t), DEFAULT_RULES] as const;
    expect(generateSchedule(...args)).toEqual(generateSchedule(...args));
  });
});

describe("franjas editadas en el alta", () => {
  it("renombrar, quitar y añadir franjas conserva las necesidades de las que quedan", () => {
    const t = getTemplate("bar");
    const roles = templateRoles(t);
    // Se queda la mañana renombrada, se quita la noche y se añade un partido.
    const shifts = customShifts(t, [
      { code: "M", label: "Apertura", start: "08:00", end: "16:00" },
      { code: "T", label: "Tarde", start: "13:00", end: "21:00" },
      { label: "Partido", start: "10:00", end: "18:00" },
      { label: "Cierre", start: "19:00", end: "02:00" },
    ]);
    expect(Object.keys(shifts)).toEqual(["M", "T", "F1", "F2"]);
    expect(shifts.M.label).toBe("Apertura");
    expect(shifts.M.hours).toBe(8);
    expect(shifts.F2.closing).toBe(true);
    expect(shifts.F1.closing).toBe(false);
    const demand = templateDemand(t, roles, shifts);
    expect(demand.every((d) => !("N" in d))).toBe(true);
    expect(demand.some((d) => d.M)).toBe(true);
    // El equipo de ejemplo puede hacer las franjas nuevas
    const team = templateTeam(t, roles, shifts);
    expect(team.every((e) => e.availability.F1.some(Boolean))).toBe(true);
    expect(team.every((e) => !("N" in e.availability))).toBe(true);
  });

  it("desde cero: si se quitan todas las franjas de la plantilla, cada puesto pide 1 persona en la primera", () => {
    const t = getTemplate("otro");
    const roles = templateRoles(t, ["Conductores", "Taller"]);
    const shifts = customShifts(t, [{ label: "Línea 12", start: "06:00", end: "14:00" }]);
    const demand = templateDemand(t, roles, shifts);
    expect(Object.keys(shifts)).toEqual(["F1"]);
    expect(demand[0].F1).toEqual({ conductores: 1, taller: 1 });
  });
});

describe("turnos partidos", async () => {
  const { shiftHours, shiftSegments, shiftTimes, restViolations } = await import("./rules");
  const { plannedWindow } = await import("../fichajes");
  const partido = { code: "P", label: "Partido", start: "12:00", end: "16:00", start2: "20:00", end2: "00:00", hours: 8, closing: true, order: 0, active: true };
  const manana = { code: "M", label: "Mañana", start: "09:00", end: "17:00", hours: 8, closing: false, order: 1, active: true };
  const shifts = { P: partido, M: manana };

  it("suma las horas de los dos tramos y los ordena", () => {
    expect(shiftHours("12:00", "16:00", "20:00", "00:00")).toBe(8);
    expect(shiftSegments(partido)).toEqual([
      { start: 12, end: 16 },
      { start: 20, end: 24 },
    ]);
    expect(shiftTimes(partido)).toBe("12:00–16:00 y 20:00–00:00");
  });

  it("el descanso cuenta desde el final del segundo tramo", () => {
    // Acaba a las 00:00 y entra a las 09:00: 9 h de descanso (< 12)
    expect(restViolations(["P", "M", "L", "L", "L", "L", "L"], shifts, 12)).toEqual([0, 1]);
    expect(restViolations(["P", "M", "L", "L", "L", "L", "L"], shifts, 9)).toEqual([]);
  });

  it("el fichaje previsto va de la primera entrada a la última salida", () => {
    const w = plannedWindow("2026-10-14", partido);
    expect(new Date(w.start).toISOString()).toBe("2026-10-14T10:00:00.000Z");
    expect(new Date(w.end).toISOString()).toBe("2026-10-14T22:00:00.000Z");
  });
});
