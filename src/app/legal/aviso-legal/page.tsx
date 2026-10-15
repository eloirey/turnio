export const metadata = { title: "Aviso legal · Rotafy" };

/*
 * PLANTILLA conforme a la Ley 34/2002 (LSSI). Sustituye lo que va entre
 * [corchetes] antes de tener clientes reales.
 */
export default function AvisoLegalPage() {
  return (
    <>
      <h1>Aviso legal</h1>
      <p className="updated">Última actualización: [FECHA]</p>

      <h2>Titular del sitio web</h2>
      <ul>
        <li>
          Titular: <strong>[NOMBRE Y APELLIDOS]</strong>
        </li>
        <li>
          NIF: <strong>[NIF]</strong>
        </li>
        <li>
          Domicilio: <strong>[DIRECCIÓN]</strong>
        </li>
        <li>
          Email: <strong>[EMAIL DE CONTACTO]</strong>
        </li>
        <li>Sitio web: rotafy.es</li>
      </ul>

      <h2>Objeto</h2>
      <p>
        Rotafy es un servicio en línea para crear y publicar cuadrantes de turnos de trabajo y llevar el registro de jornada. El uso del sitio implica la aceptación de este aviso legal.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Rotafy ayuda a detectar incumplimientos de las reglas configuradas (descansos, días libres, horas de contrato), pero no sustituye el asesoramiento laboral.
        La empresa usuaria es la única responsable de los cuadrantes que publica y de su adecuación a la normativa y al convenio aplicables.
      </p>
      <p>
        <strong>Registro de jornada.</strong> Rotafy es una herramienta para registrar la jornada, no un servicio de archivo ni de custodia. La obligación de
        conservar el registro durante cuatro años y de ponerlo a disposición de las personas trabajadoras, sus representantes y la Inspección de Trabajo
        (art. 34.9 del Estatuto de los Trabajadores) corresponde exclusivamente a la empresa usuaria. Rotafy mantiene los fichajes mientras la cuenta esté
        activa, pero no garantiza su conservación durante ese plazo ni responde de su pérdida por el borrado de la cuenta, un fallo técnico o el fin del
        servicio. La empresa debe descargar periódicamente su registro (Fichajes → Exportar registro) y guardar su propia copia.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Los contenidos, el diseño y el software de Rotafy pertenecen a su titular. Los datos que introduce cada negocio son de su propiedad.
      </p>

      <h2>Protección de datos</h2>
      <p>
        El tratamiento de datos personales se explica en la <a href="/legal/privacidad">política de privacidad</a>.
      </p>

      <h2>Legislación aplicable</h2>
      <p>Este aviso se rige por la legislación española.</p>
    </>
  );
}
