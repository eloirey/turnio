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
import { starterDemand } from "./templates";

describe("reglas: noches seguidas", () => {
  it("detecta 3 noches seguidas cuando el máximo es 2", () => {
    expect(nightRunViolations(["L", "N", "N", "N", "L", "L", "L"], 2).sort()).toEqual([1, 2, 3]);
  });
  it("acepta 2 noches seguidas", () => {
    expect(nightRunViolations(["N", "N", "L", "N", "N", "L", "L"], 2)).toEqual([]);
  });
  it("detecta una racha al final de la semana", () => {
    expect(nightRunViolations(["L", "L", "L", "L", "N", "N", "N"], 2).sort()).toEqual([4, 5, 6]);
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
  it("pone refuerzo del primer puesto las noches de viernes y sábado", () => {
    const d = starterDemand(["sala", "cocina", "barra"]);
    expect(d).toHaveLength(7);
    expect(d[0].N).toEqual({ sala: 1, cocina: 1, barra: 1 });
    expect(d[4].N).toEqual({ sala: 2, cocina: 1, barra: 1 });
    expect(starterDemand([])[0]).toEqual({});
  });

  it("crea claves de puesto únicas y sin tildes", () => {
    expect(makeRoleKey("Atención al cliente", [])).toBe("atencion-al-cliente");
    expect(makeRoleKey("Sala", ["sala"])).toBe("sala-2");
    expect(makeRoleKey("Sala", ["sala", "sala-2"])).toBe("sala-3");
    expect(makeRoleKey("¡¡!!", [])).toBe("puesto");
  });
});
