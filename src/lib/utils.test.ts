import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfMonth,
  isoWeekNumber,
  isValidISODate,
  longDateLabel,
  mondayOf,
  todayInMadrid,
  weekRangeLabel,
} from "./dates";
import {
  availabilityToRows,
  demandToRows,
  franjasToCatalog,
  gridToTurnos,
  rowsToDemand,
  rowsToGrid,
  snapshotToGrid,
  toEmployees,
} from "./data/mappers";
import { normalizePhone, whatsappLink } from "./whatsapp";

describe("fechas", () => {
  it("calcula el lunes de cualquier día de la semana", () => {
    expect(mondayOf("2026-10-12")).toBe("2026-10-12"); // lunes
    expect(mondayOf("2026-10-14")).toBe("2026-10-12"); // miércoles
    expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // domingo
  });

  it("cruza meses y años al sumar días", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("no se descuadra con el cambio de hora (25 de octubre de 2026)", () => {
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("calcula la semana ISO", () => {
    expect(isoWeekNumber("2026-10-14")).toBe(42);
    expect(isoWeekNumber("2026-01-01")).toBe(1); // jueves → semana 1
    expect(isoWeekNumber("2027-01-01")).toBe(53); // viernes → última de 2026
  });

  it("valida fechas", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("hola")).toBe(false);
  });

  it("formatea en castellano", () => {
    expect(weekRangeLabel("2026-10-12")).toBe("12 – 18 octubre");
    expect(weekRangeLabel("2026-09-28")).toBe("28 septiembre – 4 octubre");
    expect(longDateLabel("2026-10-14")).toBe("miércoles 14 de octubre");
    expect(dayOfMonth("2026-09-28", 6)).toBe(4);
  });

  it("usa el día de Madrid aunque en UTC aún sea ayer", () => {
    // 23:30 UTC del 13 = 01:30 del 14 en Madrid (horario de verano)
    expect(todayInMadrid(new Date("2026-10-13T23:30:00Z"))).toBe("2026-10-14");
  });
});

describe("whatsapp", () => {
  it("normaliza teléfonos españoles", () => {
    expect(normalizePhone("600 12 34 56")).toBe("34600123456");
    expect(normalizePhone("+34 600-123-456")).toBe("34600123456");
    expect(normalizePhone("0034600123456")).toBe("34600123456");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("codifica el mensaje en el enlace", () => {
    expect(whatsappLink("Hola & adiós", "600123456")).toBe("https://wa.me/34600123456?text=Hola%20%26%20adi%C3%B3s");
    expect(whatsappLink("Hola")).toBe("https://wa.me/?text=Hola");
  });
});

describe("mappers", () => {
  const empRows = [
    { id: "a", nombre: "Ana", puesto: "sala", horas_contrato: 40, telefono: null, token_acceso: "t1", activo: true },
    { id: "b", nombre: "Bea", puesto: "barra", horas_contrato: 20, telefono: "600123456", token_acceso: "t2", activo: true },
  ];

  it("disponibilidad: ida y vuelta sin perder datos", () => {
    const disp = [
      { empleado_id: "a", dia: 0, franja: "M" as const },
      { empleado_id: "a", dia: 6, franja: "N" as const },
    ];
    const [ana, bea] = toEmployees(empRows, disp);
    expect(ana.availability.M[0]).toBe(true);
    expect(ana.availability.N[6]).toBe(true);
    expect(ana.availability.T.every((x) => !x)).toBe(true);
    expect(bea.availability.M.every((x) => !x)).toBe(true);
    expect(availabilityToRows("a", ana.availability)).toEqual(disp);
  });

  it("demanda: ida y vuelta, ignorando cantidades a cero", () => {
    const rows = [
      { dia: 4, franja: "N" as const, puesto: "sala", cantidad: 2 },
      { dia: 4, franja: "N" as const, puesto: "barra", cantidad: 1 },
    ];
    const demand = rowsToDemand(rows);
    expect(demand).toHaveLength(7);
    expect(demand[4].N).toEqual({ sala: 2, barra: 1 });
    demand[0].M = { cocina: 0 };
    expect(demandToRows(demand)).toEqual(rows);
  });

  it("cuadrante: ida y vuelta, y libres sin fila", () => {
    const turnos = [{ empleado_id: "a", dia: 2, franja: "T" as const }];
    const grid = rowsToGrid(["a", "b"], turnos);
    expect(grid.a).toEqual(["L", "L", "T", "L", "L", "L", "L"]);
    expect(grid.b.every((c) => c === "L")).toBe(true);
    expect(gridToTurnos(grid)).toEqual(turnos);
  });

  it("ignora turnos de empleados que ya no están", () => {
    expect(Object.keys(rowsToGrid(["a"], [{ empleado_id: "zz", dia: 0, franja: "M" }]))).toEqual(["a"]);
  });

  it("lee la copia publicada", () => {
    const grid = snapshotToGrid(["a", "b"], { a: { "1": "N", "5": "M" } });
    expect(grid.a).toEqual(["L", "N", "L", "L", "L", "M", "L"]);
    expect(snapshotToGrid(["a"], null).a.every((c) => c === "L")).toBe(true);
  });

  it("convierte las franjas de la base de datos", () => {
    const cat = franjasToCatalog([{ franja: "N", etiqueta: "Noche", inicio: "18:00:00", fin: "02:00:00", horas: "8.00" }]);
    expect(cat.N).toEqual({ code: "N", label: "Noche", start: "18:00", end: "02:00", hours: 8 });
    expect(cat.M.label).toBe("Mañana"); // las que faltan usan el valor por defecto
  });
});
