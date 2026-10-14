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
        Rotafy es un servicio en línea para crear y publicar cuadrantes de turnos de trabajo. El uso del sitio implica la aceptación de este aviso legal.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Rotafy ayuda a detectar incumplimientos de las reglas configuradas (descansos, días libres, horas de contrato), pero no sustituye el asesoramiento laboral.
        La empresa usuaria es la única responsable de los cuadrantes que publica y de su adecuación a la normativa y al convenio aplicables.
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
