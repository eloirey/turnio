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
          <strong>Del encargado o titular de la cuenta:</strong> email y contraseña (cifrada) para acceder, y el nombre del negocio.
        </li>
        <li>
          <strong>De los empleados</strong>, introducidos por la empresa: nombre, puesto, horas de contrato, disponibilidad, teléfono (opcional), turnos asignados,
          ausencias (vacaciones, bajas o permisos, sin indicar diagnósticos médicos) y las solicitudes de cambio que realicen.
        </li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <p>
        Únicamente para prestar el servicio: generar y publicar cuadrantes de turnos, mostrar a cada empleado su horario y gestionar solicitudes de cambio. No
        vendemos datos ni los usamos para publicidad.
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
      <p>Los mensajes de WhatsApp los envía el propio encargado desde su teléfono: Rotafy no los envía ni los almacena.</p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la cuenta esté activa. Si la cuenta se elimina, borramos los datos en un plazo máximo de [30] días, salvo obligación legal de conservarlos.
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
        personales de los empleados son privados, aleatorios y no aparecen en buscadores.
      </p>
    </>
  );
}
