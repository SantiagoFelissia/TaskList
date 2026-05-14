/**
 * script.js — StudyDesk
 * ========================
 * Gestión de tareas escolares sin base de datos.
 * Las tareas viven en el array `tareas[]` mientras la página esté abierta.
 *
 * ESTRUCTURA DE UNA TAREA:
 * {
 *   id:       número único (timestamp)
 *   nombre:   string
 *   materia:  string
 *   fecha:    string "YYYY-MM-DD"
 *   prioridad: "Alta" | "Media" | "Baja"
 * }
 */

/* ══════════════════════════════════════
   REFERENCIAS AL DOM
══════════════════════════════════════ */
const taskForm    = document.getElementById('taskForm');
const taskName    = document.getElementById('taskName');
const taskSubject = document.getElementById('taskSubject');
const taskDate    = document.getElementById('taskDate');
const formError   = document.getElementById('formError');
const taskList    = document.getElementById('taskList');
const emptyState  = document.getElementById('emptyState');
const taskCount   = document.getElementById('taskCount');
const filterBtns  = document.querySelectorAll('.filter-btn');

/* ══════════════════════════════════════
   ESTADO DE LA APLICACIÓN
   (todo vive aquí mientras la página está abierta)
══════════════════════════════════════ */
let tareas = [];             // Array de objetos tarea
let filtroActivo = 'all';    // Filtro actual de prioridad

/* ══════════════════════════════════════
   CALCULAR URGENCIA SEGÚN LA FECHA
   Compara la fecha de entrega con hoy.
   Devuelve: 'urgent' | 'soon' | 'ok'
══════════════════════════════════════ */
function calcularUrgencia(fechaStr) {
  // Parseamos la fecha evitando problemas de zona horaria:
  // "YYYY-MM-DD" → separamos y construimos manualmente
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fechaTarea = new Date(anio, mes - 1, dia); // mes 0-indexado

  // Hoy al inicio del día (sin horas)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Diferencia en milisegundos → convertir a días
  const diffMs   = fechaTarea - hoy;
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias <= 0) return 'urgent'; // vencida o vence hoy
  if (diffDias <= 3) return 'soon';   // 1 a 3 días restantes
  return 'ok';                        // más de 3 días
}

/* ══════════════════════════════════════
   FORMATEAR FECHA para mostrar al usuario
   "2025-07-20" → "20 jul 2025"
══════════════════════════════════════ */
function formatearFecha(fechaStr) {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString('es-AR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

/* ══════════════════════════════════════
   ACTUALIZAR CONTADOR DEL SIDEBAR
══════════════════════════════════════ */
function actualizarContador() {
  taskCount.textContent = tareas.length;
}

/* ══════════════════════════════════════
   MOSTRAR / OCULTAR EL ESTADO VACÍO
══════════════════════════════════════ */
function actualizarEstadoVacio() {
  // El <li> de estado vacío se muestra solo si no hay tareas en el DOM
  // (después de aplicar filtros puede haber ítems ocultos, pero contamos los visibles)
  const visibles = taskList.querySelectorAll('.task-item:not(.hidden-by-filter)');
  emptyState.style.display = visibles.length === 0 ? 'flex' : 'none';
}

/* ══════════════════════════════════════
   CREAR EL ELEMENTO <li> DE UNA TAREA
   Recibe un objeto tarea y devuelve un <li> listo para insertar.
══════════════════════════════════════ */
function crearElementoTarea(tarea) {
  const urgencia = calcularUrgencia(tarea.fecha);

  // Etiqueta de urgencia en texto (para accesibilidad y tooltip)
  const urgenciaTexto = {
    urgent: 'Urgente',
    soon:   'Pronto',
    ok:     'A tiempo',
  }[urgencia];

  // Crear el <li>
  const li = document.createElement('li');
  li.classList.add('task-item', `urgency-${urgencia}`);
  li.dataset.id       = tarea.id;       // para identificarla al borrar
  li.dataset.prioridad = tarea.prioridad; // para los filtros

  // Verificar si debe estar oculta según el filtro activo
  if (filtroActivo !== 'all' && tarea.prioridad !== filtroActivo) {
    li.classList.add('hidden-by-filter');
  }

  // Clases CSS de prioridad para el badge
  const prioCss = {
    Alta:  'prio-alta',
    Baja:  'prio-baja',
  }[tarea.prioridad] || 'prio-media';

  // Construir el HTML interno de la tarjeta
  li.innerHTML = `
    <!-- Barra lateral de color de urgencia -->
    <div class="task-urgency-bar" title="${urgenciaTexto}"></div>

    <!-- Cuerpo: nombre, materia, fecha, prioridad -->
    <div class="task-body">
      <span class="task-name" title="${tarea.nombre}">${tarea.nombre}</span>
      <div class="task-meta">
        <span class="task-subject">${tarea.materia}</span>
        <span class="task-date">📅 ${formatearFecha(tarea.fecha)}</span>
        <span class="task-priority ${prioCss}">${tarea.prioridad}</span>
      </div>
    </div>

    <!-- Acciones: Hecho + Eliminar -->
    <div class="task-actions">
      <button class="btn-done"   data-id="${tarea.id}" aria-label="Marcar como hecho">✓ Hecho</button>
      <button class="btn-delete" data-id="${tarea.id}" aria-label="Eliminar tarea">✕ Eliminar</button>
    </div>
  `;

  /* ── Asignar eventos a los botones de la tarjeta ── */

  // Botón "Hecho": elimina la tarea
  li.querySelector('.btn-done').addEventListener('click', () => {
    eliminarTarea(tarea.id, li);
  });

  // Botón "Eliminar": también elimina la tarea
  li.querySelector('.btn-delete').addEventListener('click', () => {
    eliminarTarea(tarea.id, li);
  });

  return li;
}

/* ══════════════════════════════════════
   AGREGAR UNA TAREA
   Crea el objeto, lo guarda en el array y lo renderiza.
══════════════════════════════════════ */
function agregarTarea(nombre, materia, fecha, prioridad) {
  // Crear objeto tarea con ID único basado en timestamp
  const nuevaTarea = {
    id:        Date.now(),
    nombre:    nombre.trim(),
    materia:   materia.trim(),
    fecha:     fecha,
    prioridad: prioridad,
  };

  // Agregar al array de estado
  tareas.push(nuevaTarea);

  // Crear y agregar el elemento al DOM
  const li = crearElementoTarea(nuevaTarea);

  // Insertamos antes del estado vacío para que quede al final de la lista real
  taskList.insertBefore(li, emptyState);

  // Actualizar UI
  actualizarContador();
  actualizarEstadoVacio();
}

/* ══════════════════════════════════════
   ELIMINAR UNA TAREA
   Anima la salida del <li> y luego lo remueve del DOM y del array.
══════════════════════════════════════ */
function eliminarTarea(id, elemento) {
  // 1. Agregar clase de animación de salida
  elemento.classList.add('removing');

  // 2. Esperar a que termine la animación CSS (~300ms) y luego remover
  elemento.addEventListener('animationend', () => {
    // Remover del DOM
    elemento.remove();

    // Remover del array de estado (filter devuelve todos EXCEPTO el borrado)
    tareas = tareas.filter(t => t.id !== id);

    // Actualizar UI
    actualizarContador();
    actualizarEstadoVacio();
  }, { once: true }); // { once: true } → el listener se auto-destruye después de ejecutarse una vez
}

/* ══════════════════════════════════════
   APLICAR FILTRO DE PRIORIDAD
   Oculta/muestra tarjetas según el filtro seleccionado.
══════════════════════════════════════ */
function aplicarFiltro(filtro) {
  filtroActivo = filtro;

  // Iterar sobre todas las tarjetas en el DOM
  const items = taskList.querySelectorAll('.task-item');

  items.forEach(item => {
    const prioridadItem = item.dataset.prioridad;

    if (filtro === 'all' || prioridadItem === filtro) {
      // Mostrar: quitar clase de oculto
      item.classList.remove('hidden-by-filter');
    } else {
      // Ocultar
      item.classList.add('hidden-by-filter');
    }
  });

  actualizarEstadoVacio();
}

/* ══════════════════════════════════════
   VALIDAR EL FORMULARIO
   Devuelve true si todo está OK, false si hay errores.
══════════════════════════════════════ */
function validarFormulario() {
  const nombre   = taskName.value.trim();
  const materia  = taskSubject.value.trim();
  const fecha    = taskDate.value;
  const prioridad = taskForm.querySelector('input[name="priority"]:checked');

  // Verificar campos vacíos uno por uno
  if (!nombre) {
    mostrarError('↑ Escribí el nombre de la tarea.');
    taskName.focus();
    return false;
  }

  if (!materia) {
    mostrarError('↑ Escribí la materia.');
    taskSubject.focus();
    return false;
  }

  if (!fecha) {
    mostrarError('↑ Seleccioná una fecha límite.');
    taskDate.focus();
    return false;
  }

  if (!prioridad) {
    mostrarError('↑ Seleccioná la prioridad.');
    return false;
  }

  // Todo OK
  limpiarError();
  return true;
}

/* Mostrar y limpiar mensajes de error */
function mostrarError(msg) { formError.textContent = msg; }
function limpiarError()    { formError.textContent = ''; }

/* ══════════════════════════════════════
   LIMPIAR EL FORMULARIO
   Después de agregar una tarea, resetear los campos.
══════════════════════════════════════ */
function limpiarFormulario() {
  taskName.value    = '';
  taskSubject.value = '';
  taskDate.value    = '';
  // Dejar "Media" seleccionada por defecto
  taskForm.querySelector('input[value="Media"]').checked = true;
  limpiarError();
}

/* ══════════════════════════════════════
   EVENTO: SUBMIT DEL FORMULARIO
══════════════════════════════════════ */
taskForm.addEventListener('submit', (e) => {
  // Prevenir el comportamiento nativo (recargar la página)
  e.preventDefault();

  // Validar antes de continuar
  if (!validarFormulario()) return;

  // Leer los valores del formulario
  const nombre    = taskName.value.trim();
  const materia   = taskSubject.value.trim();
  const fecha     = taskDate.value;
  const prioridad = taskForm.querySelector('input[name="priority"]:checked').value;

  // Agregar la tarea
  agregarTarea(nombre, materia, fecha, prioridad);

  // Limpiar el formulario para la próxima entrada
  limpiarFormulario();

  // Devolver el foco al primer campo para agilizar el ingreso
  taskName.focus();
});

/* ══════════════════════════════════════
   EVENTOS: BOTONES DE FILTRO
══════════════════════════════════════ */
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Quitar clase activa del botón anterior
    filterBtns.forEach(b => b.classList.remove('active'));
    // Activar el botón clickeado
    btn.classList.add('active');
    // Aplicar el filtro
    aplicarFiltro(btn.dataset.filter);
  });
});

/* ══════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Establecer la fecha mínima del input como hoy
  // (para no poder agregar tareas con fechas pasadas si se prefiere;
  //  en este caso lo dejamos libre para flexibilidad)
  const hoy = new Date().toISOString().split('T')[0];
  taskDate.setAttribute('min', hoy);

  // Mostrar el estado vacío inicial
  actualizarEstadoVacio();

  // Foco en el primer campo
  taskName.focus();
});