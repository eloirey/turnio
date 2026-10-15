import { describe, expect, it } from "vitest";
import { checkPlace, distanceMeters, madridWeekday, type LocalPlaceConfig } from "./clock-place";
import { placeText } from "./fichajes";

const bar: LocalPlaceConfig = { control: "avisar", lat: 41.1189, lng: 1.2445, radius: 150, ips: ["83.45.12.9"] };

describe("dónde se ficha", () => {
  it("mide distancias en metros", () => {
    // Tarragona (Rambla) → Reus: unos 13 km
    expect(distanceMeters({ lat: 41.1189, lng: 1.2445 }, { lat: 41.1561, lng: 1.1069 })).toBeGreaterThan(12000);
    expect(distanceMeters({ lat: 41.1189, lng: 1.2445 }, { lat: 41.1189, lng: 1.2445 })).toBe(0);
  });

  it("dentro del radio (con la imprecisión del GPS) cuenta como en el local", () => {
    expect(checkPlace(bar, { position: { lat: 41.1195, lng: 1.2448 } }).place).toBe("local"); // ~70 m
    expect(checkPlace(bar, { position: { lat: 41.1205, lng: 1.2445, accuracy: 80 } }).place).toBe("local"); // ~178 m, margen 80
    const far = checkPlace(bar, { position: { lat: 41.1561, lng: 1.1069 } });
    expect(far).toMatchObject({ place: "fuera", blocked: false });
    expect(far.distance).toBeGreaterThan(12000);
  });

  it("la wifi del local vale aunque no haya GPS", () => {
    expect(checkPlace(bar, { ip: "83.45.12.9" })).toEqual({ place: "local", distance: null, blocked: false });
    expect(checkPlace(bar, { ip: "1.2.3.4" })).toEqual({ place: "sin_datos", distance: null, blocked: false });
  });

  it("solo en el local: bloquea fuera o sin ubicación, nunca en teletrabajo", () => {
    const strict = { ...bar, control: "bloquear" as const };
    expect(checkPlace(strict, { position: { lat: 41.1561, lng: 1.1069 } }).blocked).toBe(true);
    expect(checkPlace(strict, {}).blocked).toBe(true);
    expect(checkPlace(strict, { remoteToday: true })).toEqual({ place: "teletrabajo", distance: null, blocked: false });
  });

  it("sin control, o sin nada guardado con qué comparar, no se comprueba", () => {
    expect(checkPlace({ ...bar, control: "no" }, {}).place).toBeNull();
    expect(checkPlace({ control: "bloquear", lat: null, lng: null, radius: 200, ips: [] }, {}).blocked).toBe(false);
  });

  it("textos y día de la semana", () => {
    expect(placeText("fuera", 1250)).toBe("Fuera del local (a 1,3 km)");
    expect(placeText("fuera", 320)).toBe("Fuera del local (a 320 m)");
    expect(placeText("teletrabajo")).toBe("Teletrabajo");
    expect(madridWeekday(new Date("2026-10-15T10:00:00Z"))).toBe(3); // jueves
  });
});
