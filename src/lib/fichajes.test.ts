import { describe, expect, it } from "vitest";
import { clockCsv, dayStatus, formatHours, groupByEmployeeDay, hoursClock, madridDate, madridTime, madridToIso, recordHours, type ClockRecord } from "./fichajes";

const rec = (start: string, end: string | null, extra: Partial<ClockRecord> = {}): ClockRecord => ({
  id: start,
  employeeId: "laura",
  start,
  end,
  missingEnd: false,
  edited: false,
  ...extra,
});
const NIGHT = { start: "17:00", end: "01:00", hours: 8 };

describe("horas de Madrid", () => {
  it("convierte en horario de verano (UTC+2) y de invierno (UTC+1)", () => {
    expect(madridToIso("2026-10-14", "17:00")).toBe("2026-10-14T15:00:00.000Z");
    expect(madridToIso("2026-12-14", "17:00")).toBe("2026-12-14T16:00:00.000Z");
    expect(madridTime("2026-10-14T15:00:00Z")).toBe("17:00");
    expect(madridTime("2026-12-14T16:00:00Z")).toBe("17:00");
  });

  it("el día del cambio de hora también cuadra", () => {
    // 25 de octubre de 2026: a las 03:00 vuelven a ser las 02:00
    expect(madridToIso("2026-10-25", "10:00")).toBe("2026-10-25T09:00:00.000Z");
    expect(madridToIso("2026-10-24", "23:30")).toBe("2026-10-24T21:30:00.000Z");
  });

  it("un tramo que empieza a las 00:30 de Madrid es de ese día aunque en UTC sea el anterior", () => {
    expect(madridDate("2026-10-13T22:30:00Z")).toBe("2026-10-14");
  });
});

describe("horas trabajadas", () => {
  it("cuenta los tramos cerrados, los abiertos hasta ahora y los olvidados como 0", () => {
    expect(recordHours(rec("2026-10-14T15:00:00Z", "2026-10-14T23:30:00Z"))).toBe(8.5);
    expect(recordHours(rec("2026-10-14T15:00:00Z", null), new Date("2026-10-14T17:00:00Z"))).toBe(2);
    expect(recordHours(rec("2026-10-14T15:00:00Z", null, { missingEnd: true }))).toBe(0);
  });

  it("escribe las horas de forma legible", () => {
    expect(formatHours(7.5)).toBe("7 h 30 min");
    expect(formatHours(8)).toBe("8 h");
    expect(formatHours(0.2)).toBe("12 min");
    expect(hoursClock(7.75)).toBe("7:45");
  });
});

describe("estado del día", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("correcto si entra y sale dentro del margen (turno que cruza la medianoche)", () => {
    const s = dayStatus("2026-10-14", [rec("2026-10-14T15:04:00Z", "2026-10-14T23:02:00Z")], NIGHT, now);
    expect(s.kind).toBe("ok");
    expect(s.worked).toBeCloseTo(7.97, 1);
  });

  it("marca el retraso y la salida temprana", () => {
    expect(dayStatus("2026-10-14", [rec("2026-10-14T15:25:00Z", "2026-10-14T23:00:00Z")], NIGHT, now)).toMatchObject({ kind: "late", lateMinutes: 25 });
    expect(dayStatus("2026-10-14", [rec("2026-10-14T15:00:00Z", "2026-10-14T21:30:00Z")], NIGHT, now)).toMatchObject({ kind: "early", earlyMinutes: 90 });
  });

  it("tenía turno y no fichó / aún no ha empezado", () => {
    expect(dayStatus("2026-10-14", [], NIGHT, now).kind).toBe("missing");
    expect(dayStatus("2026-10-16", [], NIGHT, now).kind).toBe("pending");
  });

  it("trabajando, olvido y fichaje sin turno", () => {
    expect(dayStatus("2026-10-16", [rec("2026-10-16T10:00:00Z", null)], NIGHT, now).kind).toBe("open");
    expect(dayStatus("2026-10-14", [rec("2026-10-14T15:00:00Z", null, { missingEnd: true })], NIGHT, now).kind).toBe("forgot");
    expect(dayStatus("2026-10-14", [rec("2026-10-14T15:00:00Z", "2026-10-14T18:00:00Z")], null, now).kind).toBe("unplanned");
    expect(dayStatus("2026-10-14", [], null, now).kind).toBe("none");
  });

  it("varios tramos (pausa para comer) se suman", () => {
    const s = dayStatus(
      "2026-10-14",
      [rec("2026-10-14T15:00:00Z", "2026-10-14T19:00:00Z"), rec("2026-10-14T19:30:00Z", "2026-10-14T23:00:00Z")],
      NIGHT,
      now,
    );
    expect(s.kind).toBe("ok");
    expect(s.worked).toBe(7.5);
  });
});

describe("agrupar y exportar", () => {
  it("agrupa por persona y día de Madrid", () => {
    const g = groupByEmployeeDay([rec("2026-10-14T22:30:00Z", "2026-10-15T02:00:00Z"), rec("2026-10-14T15:00:00Z", "2026-10-14T18:00:00Z")]);
    expect([...g.keys()]).toEqual(["laura|2026-10-15", "laura|2026-10-14"]);
  });

  it("el CSV se abre bien en Excel en español", () => {
    const csv = clockCsv([
      {
        date: "2026-10-14",
        name: "Laura; la de barra",
        role: "Barra",
        records: [rec("2026-10-14T15:00:00Z", "2026-10-14T23:00:00Z", { edited: true })],
        planned: "Noche 17:00–01:00",
        status: "ok",
        lastReason: "Olvidó fichar",
      },
    ]);
    expect(csv.startsWith("﻿Fecha;Persona;")).toBe(true);
    expect(csv).toContain('14/10/2026;"Laura; la de barra";Barra;17:00;01:00;8:00;Noche 17:00–01:00;Correcto;Sí;Olvidó fichar');
  });
});
