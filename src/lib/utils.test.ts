import { employeePath, tokenFromPath } from "./employee-link";
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
  absencesForWeek,
  localToRules,
  rowsToDemand,
  rowsToGrid,
  snapshotToGrid,
  toEmployees,
} from "./data/mappers";
import { buildIcs, escapeText, foldLine } from "./ics";
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
    const cat = franjasToCatalog([
      { franja: "L12", etiqueta: "Línea 12", inicio: "06:00:00", fin: "14:00:00", horas: "8.00", cierre: false, orden: 1, activa: true },
      { franja: "N", etiqueta: "Noche", inicio: "18:00:00", fin: "02:00:00", horas: "8.00", cierre: true, orden: 0, activa: false },
    ]);
    expect(cat.L12).toEqual({ code: "L12", label: "Línea 12", start: "06:00", end: "14:00", hours: 8, closing: false, order: 1, active: true });
    expect(cat.N).toMatchObject({ closing: true, active: false });
    expect(cat.M).toBeUndefined(); // solo las del local
    expect(franjasToCatalog([]).M.label).toBe("Mañana"); // sin franjas, las de por defecto
  });

  it("disponibilidad y necesidades con franjas propias", () => {
    const [e] = toEmployees(
      [{ id: "a", nombre: "Ana", puesto: "conductores", horas_contrato: 40, telefono: null, token_acceso: "t", activo: true, prefiere_librar: [5, 6], min_dias_libres: 3 }],
      [{ empleado_id: "a", dia: 0, franja: "L12" }],
      ["L12", "BUHO"],
    );
    expect(e.availability.L12[0]).toBe(true);
    expect(e.availability.BUHO).toEqual([false, false, false, false, false, false, false]);
    expect(e.preferredDaysOff).toEqual([5, 6]);
    expect(e.minDaysOff).toBe(3);
    expect(e.maxConsecutiveClosings).toBeNull();
    expect(availabilityToRows("a", e.availability)).toEqual([{ empleado_id: "a", dia: 0, franja: "L12" }]);
    const rows = demandToRows([{ BUHO: { conductores: 2 } }, {}, {}, {}, {}, {}, {}]);
    expect(rows).toEqual([{ dia: 0, franja: "BUHO", puesto: "conductores", cantidad: 2 }]);
  });
});

describe("ausencias y reglas desde la base de datos", () => {
  it("convierte ausencias en días de la semana, recortando a la semana", () => {
    const map = absencesForWeek(
      [
        { id: "1", empleado_id: "a", desde: "2026-10-08", hasta: "2026-10-13", motivo: "vacaciones" },
        { id: "2", empleado_id: "b", desde: "2026-10-18", hasta: "2026-10-30", motivo: "baja" },
      ],
      "2026-10-12",
    );
    expect(map.a).toEqual(["vacaciones", "vacaciones", null, null, null, null, null]);
    expect(map.b).toEqual([null, null, null, null, null, null, "baja"]);
  });

  it("lee las reglas del local", () => {
    expect(localToRules({ id: "x", nombre: "Bar", max_noches_seguidas: 3, descanso_minimo_horas: 12, min_dias_libres: 2 })).toEqual({
      maxConsecutiveNights: 3,
      minRestHours: 12,
      minDaysOff: 2,
      maxExtraHours: 0,
    });
    expect(localToRules({ id: "x", nombre: "Bar", max_noches_seguidas: 3, descanso_minimo_horas: 10, min_dias_libres: 1, horas_extra_max: 6 }).maxExtraHours).toBe(6);
  });
});

describe("calendario .ics", () => {
  const ics = buildIcs({
    calendarName: "Turnos · Bar, La Plaza",
    now: new Date("2026-10-14T10:00:00Z"),
    events: [{ uid: "w-e-2@rotafy.es", date: "2026-10-14", start: "17:00", end: "01:00", summary: "Noche · Bar" }],
  });

  it("usa CRLF y empieza y acaba bien", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });

  it("un turno que cruza la medianoche termina al día siguiente, en hora de Madrid", () => {
    expect(ics).toContain("DTSTART;TZID=Europe/Madrid:20261014T170000");
    expect(ics).toContain("DTEND;TZID=Europe/Madrid:20261015T010000");
    expect(ics).toContain("TZID:Europe/Madrid");
  });

  it("escapa comas, puntos y coma y saltos de línea", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(ics).toContain("X-WR-CALNAME:Turnos · Bar\\, La Plaza");
  });

  it("parte las líneas largas sin superar 75 octetos", () => {
    const folded = foldLine("SUMMARY:" + "á".repeat(60));
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((p) => p.startsWith(" "))).toBe(true);
  });
});

describe("enlace personal con nombre", () => {
  const token = "ecfdc46614114b71b2c2d5168cb6efd1";
  it("pone el nombre delante del token, sin acentos ni símbolos", () => {
    expect(employeePath("Laura", token)).toBe(`laura-${token}`);
    expect(employeePath("María José Núñez", token)).toBe(`maria-jose-nunez-${token}`);
    expect(employeePath("  ¡¡  ", token)).toBe(token);
  });
  it("saca el token del enlace nuevo y del antiguo", () => {
    expect(tokenFromPath(`laura-${token}`)).toBe(token);
    expect(tokenFromPath(token)).toBe(token);
    expect(tokenFromPath(`maria-jose-${token}`)).toBe(token);
    expect(tokenFromPath(encodeURIComponent(`maría-${token}`))).toBe(token);
  });
  it("rechaza enlaces sin un token válido", () => {
    expect(tokenFromPath("laura")).toBeNull();
    expect(tokenFromPath(`laura${token}`)).toBeNull(); // sin guion no es un token separado
    expect(tokenFromPath(token.slice(1))).toBeNull();
    expect(tokenFromPath(`${token}x`)).toBeNull();
  });
});
