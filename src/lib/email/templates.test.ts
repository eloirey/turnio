import { describe, expect, it } from "vitest";
import { SUPABASE_TEMPLATES, esc, welcomeEmail } from "./templates";

describe("correos", () => {
  // Las plantillas de supabase/templates se generan desde aquí: `npx vitest run -u` las actualiza.
  for (const [name, t] of Object.entries(SUPABASE_TEMPLATES)) {
    it(`plantilla de Supabase «${name}» al día`, async () => {
      expect(t.html).toContain("{{ .ConfirmationURL }}");
      await expect(t.html).toMatchFileSnapshot(`../../../supabase/templates/${name}.html`);
    });
  }

  it("la bienvenida escapa el nombre del negocio", () => {
    const w = welcomeEmail({ localName: 'Bar <script>alert(1)</script> & "Co"', appUrl: "https://rotafy.es/" });
    expect(w.html).not.toContain("<script>");
    expect(w.html).toContain("Bar &lt;script&gt;");
    expect(w.html).toContain('href="https://rotafy.es/app/cuadrante"');
    expect(w.subject).toBe('«Bar <script>alert(1)</script> & "Co"» ya está en Rotafy');
    expect(w.text).toContain("1. Añade a tu equipo");
  });

  it("la bienvenida lleva el botón y los tres pasos", () => {
    const { html } = welcomeEmail({ localName: "Bar Pepe", appUrl: "https://rotafy.es" });
    expect(html).toContain("Ir a mi cuadrante");
    expect(html.indexOf("Genera y publica")).toBeLessThan(html.indexOf("Ir a mi cuadrante"));
  });

  it("esc", () => expect(esc(`a<b>&"'`)).toBe("a&lt;b&gt;&amp;&quot;&#39;"));
});
