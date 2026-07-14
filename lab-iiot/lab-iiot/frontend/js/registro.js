const API = `${window.location.origin}/api`;

// Fecha y hora en tiempo real
function actualizarReloj() {
  const ahora = new Date();
  document.getElementById('fecha').value = ahora.toLocaleDateString('es-MX');
  document.getElementById('hora').value = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
actualizarReloj();
setInterval(actualizarReloj, 1000);

// Generar filas de integrantes según selector
document.getElementById('num-integrantes').addEventListener('change', function () {
  renderIntegrantes(parseInt(this.value));
});

function renderIntegrantes(n) {
  const contenedor = document.getElementById('lista-integrantes');
  contenedor.innerHTML = '';
  for (let i = 1; i <= n; i++) {
    contenedor.innerHTML += `
      <div class="fila-integrante" id="integrante-${i}">
        <div class="fila-num">${i}</div>
        <input type="text" placeholder="Nombre completo" class="nombre-integrante">
        <input type="text" placeholder="Matrícula" class="matricula-integrante" style="max-width:130px">
        ${i > 1 ? `<button class="btn-eliminar" onclick="eliminarIntegrante(${i})" title="Eliminar">✕</button>` : '<div></div>'}
      </div>`;
  }
}

function eliminarIntegrante(id) {
  document.getElementById(`integrante-${id}`).remove();
  renumerarFilas('lista-integrantes', 'integrante-', 'fila-num');
  // Actualizar selector
  const total = document.querySelectorAll('#lista-integrantes .fila-integrante').length;
  document.getElementById('num-integrantes').value = total;
}

// Materiales
let contadorMaterial = 1;

function agregarMaterial() {
  const contenedor = document.getElementById('lista-materiales');
  contadorMaterial++;
  const div = document.createElement('div');
  div.className = 'fila-material';
  div.id = `material-${contadorMaterial}`;
  div.innerHTML = `
    <div class="fila-num">${contenedor.children.length + 1}</div>
    <input type="text" placeholder="Nombre del material" class="nombre-material">
    <input type="text" placeholder="Núm. de registro" class="num-material" style="max-width:160px">
    <button class="btn-eliminar" onclick="eliminarMaterial(${contadorMaterial})" title="Eliminar">✕</button>`;
  contenedor.appendChild(div);
}

function eliminarMaterial(id) {
  const el = document.getElementById(`material-${id}`);
  if (el) el.remove();
  renumerarFilas('lista-materiales', 'material-', 'fila-num');
}

function renumerarFilas(contenedorId, prefijo, claseNum) {
  const filas = document.querySelectorAll(`#${contenedorId} > div`);
  filas.forEach((fila, idx) => {
    const num = fila.querySelector(`.${claseNum}`);
    if (num) num.textContent = idx + 1;
  });
}

// Inicializar con 2 integrantes y 1 material
renderIntegrantes(2);
document.getElementById('lista-materiales').innerHTML = `
  <div class="fila-material" id="material-1">
    <div class="fila-num">1</div>
    <input type="text" placeholder="Nombre del material" class="nombre-material">
    <input type="text" placeholder="Núm. de registro" class="num-material" style="max-width:160px">
    <div></div>
  </div>`;

// Enviar registro
async function enviarRegistro() {
  const laboratorio = document.getElementById('laboratorio').value;
  if (!laboratorio) return mostrarMensaje('Seleccione un laboratorio.', 'error');

  const integrantes = [];
  document.querySelectorAll('#lista-integrantes .fila-integrante').forEach(fila => {
    const nombre = fila.querySelector('.nombre-integrante').value.trim();
    const matricula = fila.querySelector('.matricula-integrante').value.trim();
    integrantes.push({ nombre_completo: nombre, matricula });
  });

  const materiales = [];
  document.querySelectorAll('#lista-materiales .fila-material').forEach(fila => {
    const nombre = fila.querySelector('.nombre-material').value.trim();
    const num = fila.querySelector('.num-material').value.trim();
    materiales.push({ nombre_material: nombre, numero_registro: num });
  });

  // Validaciones básicas en frontend
  for (const i of integrantes) {
    if (!i.nombre_completo || !i.matricula) {
      return mostrarMensaje('Complete nombre y matrícula de todos los integrantes.', 'error');
    }
  }
  for (const m of materiales) {
    if (!m.nombre_material || !m.numero_registro) {
      return mostrarMensaje('Complete nombre y número de registro de todos los materiales.', 'error');
    }
  }

  try {
    const res = await fetch(`${API}/registros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ laboratorio, integrantes, materiales })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    mostrarMensaje(`✓ Registro guardado correctamente. Folio: ${data.folio}`, 'exito');
    limpiarFormulario();
  } catch (err) {
    mostrarMensaje('Error al guardar el registro: ' + err.message, 'error');
  }
}

function limpiarFormulario() {
  document.getElementById('laboratorio').value = '';
  document.getElementById('num-integrantes').value = '2';
  renderIntegrantes(2);
  document.getElementById('lista-materiales').innerHTML = `
    <div class="fila-material" id="material-1">
      <div class="fila-num">1</div>
      <input type="text" placeholder="Nombre del material" class="nombre-material">
      <input type="text" placeholder="Núm. de registro" class="num-material" style="max-width:160px">
      <div></div>
    </div>`;
  contadorMaterial = 1;
}

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}
