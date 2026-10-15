import Link from "next/link";

export const metadata = { title: "Política de privacidad · Rotafy" };

/*
 * PLANTILLA. Antes de tener clientes reales:
 *  1. Sustituye todo lo que va entre [corchetes].
 *  2. Haz que la revise un profesional (asesoría o abogado).
 */
export default function PrivacidadPage() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="updated">Última actualización: [FECHA]</p>

      <h2>1. Quién es el responsable</h2>
      <p>
        El responsable del tratamiento es <strong>[NOMBRE Y APELLIDOS]</strong>, con NIF <strong>[NIF]</strong> y domicilio en <strong>[DIRECCIÓN]</strong>. Puedes
        escribir a <strong>[EMAIL DE CONTACTO]</strong> para cualquier cuestión sobre tus datos.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>Del encargado o titular de la cuenta:</strong> email y contraseña (cifrada) para acceder —o los datos básicos de tu cuenta de Google si entras
          con ella—, y el nombre del negocio. Si el titular invita a otros encargados, también el email con el que entra cada uno.
        </li>
        <li>
          <strong>De los empleados</strong>, introducidos por la empresa: nombre, puesto, horas de contrato, disponibilidad, teléfono (opcional), turnos asignados,
          ausencias (vacaciones, bajas o permisos, sin indicar diagnósticos médicos) y las solicitudes de cambio que realicen.
        </li>
        <li>
          <strong>Registro de jornada</strong> (si la empresa activa el fichaje): hora de entrada y salida de cada tramo trabajado y, si el encargado corrige un
          fichaje, la hora original, la nueva y el motivo.
        </li>
        <li>
          <strong>Comprobación del lugar al fichar</strong> (solo si la empresa la activa): en el momento de fichar, el móvil del empleado envía su posición o se
          mira la red wifi desde la que ficha, para saber si está en el local. <strong>Las coordenadas no se guardan</strong>: solo queda el resultado («en el
          local», «fuera del local», «teletrabajo» o «sin datos») y, si estaba fuera, la distancia aproximada. No hay seguimiento continuo: solo se consulta al
          pulsar el botón de fichar, y el navegador siempre pide permiso antes. La empresa debe informar a su plantilla de esta medida (art. 90 LOPDGDD).
        </li>
        <li>
          <strong>Avisos en el móvil</strong> (si cada persona los activa): la dirección técnica que da el navegador para poder enviar notificaciones a ese
          dispositivo. Se borra al desactivarlos o cuando el navegador deja de aceptarlos.
        </li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <p>
        Únicamente para prestar el servicio: generar y publicar cuadrantes de turnos, mostrar a cada empleado su horario, gestionar solicitudes de cambio y, si
        la empresa lo activa, llevar el registro de jornada que exige el artículo 34.9 del Estatuto de los Trabajadores. No vendemos datos ni los usamos para
        publicidad.
      </p>

      <h2>4. Base legal</h2>
      <p>
        Respecto al titular de la cuenta, la ejecución del contrato de servicio. Respecto a los datos de los empleados, la empresa usuaria es la{" "}
        <strong>responsable del tratamiento</strong> y Rotafy actúa como <strong>encargado del tratamiento</strong> por cuenta de ella, conforme al artículo 28 del
        RGPD.
      </p>

      <h2>5. Con quién los compartimos</h2>
      <p>Usamos proveedores que tratan datos por nuestra cuenta, con contratos que garantizan su protección:</p>
      <ul>
        <li>
          <strong>Supabase</strong> (base de datos y autenticación), con los datos alojados en la Unión Europea.
        </li>
        <li>
          <strong>[PROVEEDOR DE HOSTING, p. ej. Netlify]</strong> (alojamiento de la web). Puede procesar datos en Estados Unidos, amparado en las cláusulas
          contractuales tipo de la Comisión Europea y/o el Marco de Privacidad de Datos UE-EE. UU.
        </li>
      </ul>
      <p>Los mensajes de WhatsApp o Telegram los envía el propio encargado desde su teléfono: Rotafy no los envía ni los almacena.</p>
      <p>
        Los avisos en el móvil se entregan a través del servicio de notificaciones del propio navegador (Google, Apple o Mozilla, según el dispositivo), que solo
        recibe el texto del aviso cifrado.
      </p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la cuenta esté activa. El registro de jornada se mantiene aunque la persona deje la empresa, para que esta pueda cumplir su obligación de
        conservarlo cuatro años. Aun así, Rotafy no es un servicio de archivo: la responsable de conservarlo es la empresa, que debe descargar una copia cada
        mes. Si el titular borra la cuenta desde Ajustes, se eliminan todos los datos del negocio, incluido el registro de jornada.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <strong>[EMAIL DE CONTACTO]</strong>.
        Si eres empleado de un negocio que usa Rotafy, también puedes dirigirte directamente a tu empresa. Tienes derecho a reclamar ante la Agencia Española de
        Protección de Datos (aepd.es).
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Las comunicaciones van cifradas (HTTPS) y cada negocio solo puede acceder a sus propios datos gracias a controles en la propia base de datos. Los enlaces
        personales de los empleados son privados, aleatorios y no aparecen en buscadores. Cada enlace es solo para su empleado: si se comparte o se pierde, el
        encargado puede cambiarlo y el anterior deja de funcionar.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Solo usamos cookies técnicas necesarias para iniciar sesión, sin analítica ni publicidad. Tienes el detalle en la{" "}
        <Link href="/legal/cookies">política de cookies</Link>.
      </p>
    </>
  );
}
