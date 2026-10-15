export const metadata = { title: "Cookies · Rotafy" };

/*
 * Rotafy solo usa cookies técnicas (estrictamente necesarias), exentas de
 * consentimiento según el art. 22.2 de la LSSI y la Guía sobre cookies de la
 * AEPD. Si algún día se añade analítica o publicidad, habrá que poner un
 * banner de consentimiento ANTES de cargarla y actualizar esta página.
 */
export default function CookiesPage() {
  return (
    <>
      <h1>Política de cookies</h1>
      <p className="updated">Última actualización: [FECHA]</p>

      <h2>Resumen</h2>
      <p>
        Rotafy <strong>no usa cookies de análisis, publicidad ni seguimiento</strong>. Solo usamos las imprescindibles para que puedas iniciar sesión y para
        recordar en qué paso de la guía te quedaste. Por eso no te mostramos ningún aviso para aceptarlas: la ley (art. 22.2 de la LSSI) no exige
        consentimiento para las cookies estrictamente necesarias.
      </p>

      <h2>Qué guardamos en tu navegador</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Para qué</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sb-…-auth-token</code>
            </td>
            <td>Mantener tu sesión iniciada en la cuenta de encargado. Sin ella no podrías entrar.</td>
            <td>Hasta que cierres sesión (se renueva sola)</td>
          </tr>
          <tr>
            <td>
              <code>sb-…-code-verifier</code>
            </td>
            <td>Completar de forma segura el inicio de sesión con Google o el cambio de contraseña.</td>
            <td>Unos minutos</td>
          </tr>
          <tr>
            <td>
              <code>rotafy:guia</code> (almacenamiento local)
            </td>
            <td>Recordar si tienes abierta la guía y en qué paso vas.</td>
            <td>Hasta que la borres desde tu navegador</td>
          </tr>
        </tbody>
      </table>
      <p>
        La página de horario de cada empleado (su enlace personal) no guarda ninguna cookie: funciona solo con el enlace.
      </p>

      <h2>Cookies de terceros</h2>
      <p>
        Ninguna en nuestra web. Si eliges «Continuar con Google», durante el inicio de sesión estarás en una página de Google, que aplica su propia política de
        cookies.
      </p>

      <h2>Cómo borrarlas</h2>
      <p>
        Puedes borrarlas o bloquearlas desde la configuración de tu navegador. Si bloqueas las de sesión, no podrás entrar en tu cuenta de encargado.
      </p>

      <p>
        Si tienes dudas, escribe a <strong>[EMAIL DE CONTACTO]</strong>.
      </p>
    </>
  );
}
