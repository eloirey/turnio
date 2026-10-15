import { describe, expect, it } from "vitest";
import { SUPABASE_TEMPLATES, esc } from "./templates";

describe("correos", () => {
  // Las plantillas de supabase/templates se generan desde aquí: `npx vitest run -u` las actualiza.
  for (const [name, t] of Object.entries(SUPABASE_TEMPLATES)) {
    it(`plantilla de Supabase «${name}» al día`, async () => {
      expect(t.html).toContain("{{ .ConfirmationURL }}");
      await expect(t.html).toMatchFileSnapshot(`../../../supabase/templates/${name}.html`);
    });
  }

  it("esc", () => expect(esc(`a<b>&"'`)).toBe("a&lt;b&gt;&amp;&quot;&#39;"));
});
