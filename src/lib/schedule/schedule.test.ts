import { describe, expect, it } from "vitest";
import { DEMO_DEMAND, DEMO_EMPLOYEES } from "./demo-data";
import {
  DEFAULT_RULES,
  DEFAULT_SHIFTS,
  findGaps,
  findIssues,
  generateSchedule,
  hoursByEmployee,
  nightRunViolations,
  nightThenMorningViolations,
  type Code,
} from "./index";

describe("reglas", () => {
  it("detecta 3 noches seguidas cuando el máximo es 2", () => {
    const row: Code[] = ["L", "N", "N", "N", "L", "L", "L"];
    expect(nightRunViolations(row, 2).sort()).toEqual([1, 2, 3]);
  });

  it("acepta 2 noches seguidas", () => {
    const row: Code[] = ["N", "N", "L", "N", "N", "L", "L"];
    expect(nightRunViolations(row, 2)).toEqual([]);
  });

  it("detecta una racha de noches al final de la semana", () => {
    const row: Code[] = ["L", "L", "L", "L", "N", "N", "N"];
    expect(nightRunViolations(row, 2).sort()).toEqual([4, 5, 6]);
  });

  it("detecta entrar de mañana tras cerrar", () => {
    const row: Code[] = ["N", "M", "L", "L", "L", "L", "L"];
    expect(nightThenMorningViolations(row)).toEqual([0, 1]);
  });
});

describe("generador con la plantilla de ejemplo", () => {
  const grid = generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND);

  it("asigna como mucho un turno por persona y día", () => {
    for (const e of DEMO_EMPLOYEES) expect(grid[e.id]).toHaveLength(7);
  });

  it("nunca asigna fuera de la disponibilidad", () => {
    for (const e of DEMO_EMPLOYEES) {
      grid[e.id].forEach((c, d) => {
        if (c !== "L") expect(e.availability[c][d]).toBe(true);
      });
    }
  });

  it("solo asigna a cada persona turnos de su puesto que se necesitan", () => {
    for (const e of DEMO_EMPLOYEES) {
      grid[e.id].forEach((c, d) => {
        if (c !== "L") expect(DEMO_DEMAND[d][c]?.[e.role] ?? 0).toBeGreaterThan(0);
      });
    }
  });

  it("nunca supera las horas de contrato", () => {
    const hours = hoursByEmployee(grid, DEMO_EMPLOYEES);
    for (const e of DEMO_EMPLOYEES) expect(hours[e.id]).toBeLessThanOrEqual(e.contractHours);
  });

  it("no genera ningún conflicto de reglas", () => {
    expect(findIssues(grid, DEMO_EMPLOYEES, DEFAULT_SHIFTS, DEFAULT_RULES)).toEqual([]);
  });

  it("no cubre más plazas de las necesarias", () => {
    for (let d = 0; d < 7; d++) {
      for (const slot of ["M", "T", "N"] as const) {
        for (const role of ["sala", "cocina", "barra"]) {
          const assigned = DEMO_EMPLOYEES.filter((e) => e.role === role && grid[e.id][d] === slot).length;
          expect(assigned).toBeLessThanOrEqual(DEMO_DEMAND[d][slot]?.[role] ?? 0);
        }
      }
    }
  });

  it("es determinista: misma entrada, mismo cuadrante", () => {
    expect(generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND)).toEqual(grid);
  });

  it("deja como hueco la barra que nadie puede cubrir sin romper reglas", () => {
    // Entre semana solo Laura puede hacer barra de noche (mar–jue).
    // Cubrir las 3 noches le haría cerrar 3 seguidas, así que una debe quedar libre.
    const gaps = findGaps(grid, DEMO_EMPLOYEES, DEMO_DEMAND);
    const barraWeekdayGaps = gaps.filter((g) => g.role === "barra" && g.slot === "N" && g.day >= 1 && g.day <= 3);
    expect(barraWeekdayGaps.reduce((a, g) => a + g.missing, 0)).toBe(1);
  });
});

describe("validador", () => {
  it("avisa de horas de más y de turnos fuera de disponibilidad", () => {
    const grid = generateSchedule(DEMO_EMPLOYEES, DEMO_DEMAND);
    grid["aleix"] = ["N", "N", "L", "N", "N", "L", "L"]; // 32 h con contrato de 20
    grid["marta"] = [...grid["marta"]];
    grid["marta"][6] = "M"; // Marta no está disponible el domingo
    const kinds = findIssues(grid, DEMO_EMPLOYEES).map((i) => `${i.employeeId}:${i.kind}`);
    expect(kinds).toContain("aleix:over-contract");
    expect(kinds).toContain("marta:outside-availability");
  });
});

describe("plantilla inicial", () => {
  it("pone refuerzo en sala y barra las noches de viernes y sábado", async () => {
    const { starterDemand } = await import("./templates");
    const d = starterDemand(["sala", "cocina", "barra"]);
    expect(d).toHaveLength(7);
    expect(d[0].N).toEqual({ sala: 1, cocina: 1, barra: 1 });
    expect(d[4].N).toEqual({ sala: 2, cocina: 1, barra: 2 });
    expect(d[6].M).toEqual({ sala: 1, cocina: 1, barra: 1 });
    expect(starterDemand([])[0]).toEqual({});
  });
});
