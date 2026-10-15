/**
 * Ayuda de cada pantalla de la app: qué es y las dudas más habituales.
 * Se muestra con el botón «Ayuda» de la cabecera.
 */

export interface HelpTopic {
  q: string;
  a: string;
}

export interface ScreenHelp {
  title: string;
  intro: string;
  topics: HelpTopic[];
}

const HELP: Record<string, ScreenHelp> = {
  "/app/cuadrante": {
    title: "Cuadrante",
    intro: "Aquí haces el horario de la semana: lo generas, lo retocas y lo publicas para que tu equipo lo vea.",
    topics: [
      {
        q: "¿Cómo genero el cuadrante?",
        a: "Pulsa «Generar automáticamente». Rotafy reparte los turnos según lo que pusiste en Necesidades, la disponibilidad y las horas de contrato de cada persona, las ausencias y las reglas de Ajustes. Si no te gusta, pulsa «Deshacer» en el aviso de abajo.",
      },
      {
        q: "¿Cómo cambio un turno?",
        a: "Toca la casilla y elige otra franja o «Libre». Si el cambio incumple una regla, la casilla se marca en rojo y lo verás explicado en el panel de la derecha.",
      },
      {
        q: "¿Qué son los avisos en rojo?",
        a: "Son franjas en las que falta gente o personas que se saltan alguna regla: descanso entre jornadas, días libres, cierres seguidos o más horas de las de su contrato. Toca un aviso para ir a la casilla.",
      },
      {
        q: "¿Qué es lo que sale debajo de cada turno?",
        a: "Es el fichaje real de esa persona ese día (solo si tienes el fichaje activado). «✓ 08:58–17:00» es que fichó a su hora; «Tarde +18′», que entró tarde; «● 08:58», que está trabajando ahora; «No fichó» o «Sin salida», que hay que revisarlo en Fichajes. El «⏱» de la columna Horas son las horas fichadas en la semana.",
      },
      {
        q: "¿Cómo voy a otra semana o a un día concreto?",
        a: "Con las flechas ‹ › vas de semana en semana. Para saltar más lejos, toca las fechas de arriba (por ejemplo «12 – 18 octubre») y elige el día en el calendario.",
      },
      {
        q: "¿Mi equipo ve los cambios mientras edito?",
        a: "No. Todo se guarda solo como borrador y tu equipo no ve nada hasta que pulsas «Publicar y avisar». Si cambias algo después de publicar, el botón pasa a «Publicar cambios».",
      },
      {
        q: "¿Qué pasa al publicar?",
        a: "Cada persona ve su horario en su enlace personal y en su calendario, si se suscribió, y le llega un aviso a su campanita. Además se abre una lista para mandar a cada uno su horario por WhatsApp o Telegram con un toque. Si vuelves a publicar con cambios, solo a quien le cambia algo le llega «Ha cambiado tu horario».",
      },
      {
        q: "¿Cómo copio la semana anterior, imprimo o exporto a Excel?",
        a: "En el menú «Más», junto a «Generar automáticamente».",
      },
      {
        q: "Alguien ha pedido librar o un cambio",
        a: "Te llega un aviso a la campanita (arriba) y la solicitud aparece arriba del todo en el panel de la derecha. Si la aceptas, el cuadrante se actualiza solo; acuérdate de publicar los cambios.",
      },
      {
        q: "¿Para qué es la campanita?",
        a: "Ahí te avisamos de lo importante: solicitudes de tu equipo, alguien que olvidó fichar la salida y novedades de Rotafy. El número rojo son los avisos sin leer.",
      },
    ],
  },
  "/app/fichajes": {
    title: "Fichajes",
    intro: "El registro de jornada de tu equipo: quién está trabajando, las horas de cada uno y lo que hay que corregir.",
    topics: [
      {
        q: "¿Cómo fichan mis empleados?",
        a: "Desde su enlace personal, con el botón grande de «Fichar entrada» y «Fichar salida». No instalan nada. La hora la pone el servidor, así que no sirve cambiar la hora del móvil.",
      },
      {
        q: "Alguien se olvidó de fichar la salida",
        a: "Toca su día (aparece en «Por revisar»), pon la hora real y escribe el motivo. Queda guardado en el historial junto con la hora original, como pide la ley.",
      },
      {
        q: "¿Qué significan los colores?",
        a: "Verde: correcto. Naranja: entró tarde o salió antes, por encima del margen que pusiste en Ajustes. Rojo: hay que revisarlo (no fichó o no fichó la salida). Para ir a otra semana, toca las fechas de arriba.",
      },
      {
        q: "¿Cómo saco el registro para la gestoría o la Inspección?",
        a: "Pulsa «Exportar registro…»: eliges el mes, qué quieres (registro detallado, resumen por persona u horas por día) y si lo quieres en Excel o CSV. El registro detallado tiene todas las entradas, salidas, horas y correcciones.",
      },
      {
        q: "¿Rotafy guarda los fichajes para siempre?",
        a: "No. Rotafy no es un servicio de archivo: la obligación de conservar el registro cuatro años es de tu empresa. Lo mantenemos mientras tengas la cuenta, pero descarga el Excel cada mes y guárdalo tú (o mándalo a tu gestoría).",
      },
      {
        q: "¿Y si fichan desde casa?",
        a: "En Ajustes → Fichaje elige «Avisarme si fichan fuera» o «Solo en el local» y guarda la ubicación del local (y, si quieres, su wifi). Al fichar se comprueba si está en el local; no se guarda la ubicación de nadie. Lo fichado fuera sale con «📍 Fuera» y te llega a la campanita. Quien teletrabaja se marca en su ficha de Equipo.",
      },
      {
        q: "¿Mis empleados pueden ver lo que han fichado?",
        a: "Sí, tienen derecho. En su enlace, «Mi registro de jornada» les enseña cada día del mes y pueden descargarlo en Excel o CSV.",
      },
      {
        q: "Lo he activado a mitad de semana: ¿los días anteriores cuentan como «No fichó»?",
        a: "No. Rotafy solo revisa desde el día en que activaste el fichaje. Los días de antes salen con el turno previsto, sin marcar nada.",
      },
      {
        q: "¿Puedo desactivar el fichaje?",
        a: "Sí, en Ajustes → Fichaje. Los fichajes que ya hay no se borran.",
      },
    ],
  },
  "/app/empleados": {
    title: "Equipo",
    intro: "Las personas que trabajan contigo y lo que el generador necesita saber de cada una.",
    topics: [
      {
        q: "¿Cómo añado a alguien?",
        a: "Pulsa «+ Añadir persona», pon su nombre, puesto y horas de contrato, marca en la tabla cuándo puede trabajar y pulsa «Añadir al equipo» (el botón se queda fijo abajo mientras rellenas). El móvil es opcional y sirve para mandarle el horario directamente por WhatsApp.",
      },
      {
        q: "¿Qué es la tabla de disponibilidad?",
        a: "Las franjas y días en que esa persona puede trabajar. El generador nunca le pondrá un turno fuera de lo marcado en verde.",
      },
      {
        q: "Esta persona tiene un acuerdo distinto",
        a: "Abre «Preferencias y reglas propias» y pulsa «Personalizar»: días libres mínimos, máximo de cierres seguidos y los días que prefiere librar. Solo cambian para ella; el resto sigue las reglas de Ajustes.",
      },
      {
        q: "Vacaciones, bajas y permisos",
        a: "En «Ausencias» de su ficha. Esos días el generador no le pone turnos y el cuadrante lo marca.",
      },
      {
        q: "¿Para qué es el enlace personal?",
        a: "Es la página de esa persona: ve su horario, ficha y lo añade a su calendario, sin registrarse. Es único y no se debe compartir, porque con él se ficha a su nombre. Si lo pierde o se lo pasa a alguien, toca «cambia el enlace» y el anterior deja de funcionar.",
      },
      {
        q: "Esta persona teletrabaja",
        a: "En «Preferencias y reglas propias» marca «Teletrabajo» y elige sus días (o todos). Esos días puede fichar desde cualquier sitio y su fichaje sale como «Teletrabajo».",
      },
      {
        q: "¿Cómo le llegan los avisos al móvil?",
        a: "En su enlace tiene un botón «Activar avisos». En Android funciona directamente; en iPhone, Apple pide añadir antes la página a la pantalla de inicio (le salen las instrucciones).",
      },
      {
        q: "¿Qué pasa si elimino a alguien?",
        a: "Se quitan sus turnos futuros y su enlace deja de funcionar. Si alguna vez fichó, se archiva en lugar de borrarse, para que su registro de jornada siga en Fichajes.",
      },
    ],
  },
  "/app/necesidades": {
    title: "Necesidades",
    intro: "Cuánta gente de cada puesto necesitas en cada franja y día. Es lo que el generador intenta cubrir.",
    topics: [
      {
        q: "¿Cómo pongo cuánta gente necesito?",
        a: "En la tabla, cada casilla es una franja de un día. Usa − y + para cada puesto. Al acabar, pulsa «Guardar».",
      },
      {
        q: "¿Puedo cambiar el nombre o el horario de las franjas?",
        a: "Sí, en la tarjeta de franjas: renómbralas como las llaméis («Partido», «Línea 12»…), cambia el horario, ordénalas o añade hasta 8.",
      },
      {
        q: "¿Y los turnos partidos?",
        a: "Marca «Turno partido» en la franja y pon el segundo tramo (por ejemplo, de 12:00 a 16:00 y de 20:00 a 00:00). Cuenta como un solo turno con las horas de los dos tramos; el descanso hasta el día siguiente se cuenta desde el final del segundo.",
      },
      {
        q: "¿Qué es una franja de cierre?",
        a: "Una que acaba tarde. Cuenta para la regla de «máximo de cierres seguidos» de Ajustes, para no poner a la misma persona a cerrar muchos días seguidos.",
      },
      {
        q: "¿Qué pasa si quito una franja?",
        a: "Deja de usarse para generar. Si ya había turnos con ella en semanas anteriores, se conservan en el historial.",
      },
    ],
  },
  "/app/ajustes": {
    title: "Ajustes",
    intro: "Las reglas que sigue el generador, el fichaje y los puestos de tu negocio.",
    topics: [
      {
        q: "¿Qué valores pongo en las reglas?",
        a: "Los de tu convenio. Puedes escribir el número o usar − y +. Si algo se sale de lo habitual o de lo que marca el Estatuto de los Trabajadores, te avisamos debajo.",
      },
      {
        q: "Una persona tiene reglas distintas",
        a: "Se cambian en su ficha: Equipo → Preferencias y reglas propias.",
      },
      {
        q: "¿Qué es el margen para retrasos?",
        a: "Los minutos de cortesía antes de marcar que alguien entró tarde o salió antes. Con 10 minutos, entrar a las 09:08 cuenta como a su hora.",
      },
      {
        q: "No puedo quitar un puesto",
        a: "Si alguien lo tiene asignado, primero cámbiale el puesto en Equipo.",
      },
      {
        q: "¿Puede haber más de un encargado?",
        a: "Sí. En «Encargados», pulsa «Invitar a otro encargado» y mándale el enlace. Entra con su propio email o con Google y podrá hacer todo lo mismo que tú, menos borrar la cuenta. Puedes quitarlo cuando quieras.",
      },
      {
        q: "¿Qué es «¿Desde dónde se puede fichar?»?",
        a: "Para que nadie fiche desde casa. Con «Avisarme» ficha igual pero te avisamos; con «Solo en el local» no le deja. Guarda la ubicación estando en el local (y su wifi si el GPS falla dentro).",
      },
      {
        q: "¿Cómo borro mi cuenta?",
        a: "Al final de esta página. Se borra todo, también el registro de jornada, así que descárgalo antes desde Fichajes.",
      },
    ],
  },
};

export function helpFor(pathname: string): ScreenHelp | null {
  const key = Object.keys(HELP).find((k) => pathname.startsWith(k));
  return key ? HELP[key] : null;
}
