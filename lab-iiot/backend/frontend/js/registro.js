const API = `${window.location.origin}/api`;

function actualizarReloj() {
  const ahora = new Date();
  document.getElementById('fecha').value = ahora.toLocaleDateString('es-MX');
  document.getElementById('hora').value = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
actualizarReloj();
setInterval(actualizarReloj, 1000);

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
  const elemento = document.getElementById(`integrante-${id}`);
  if (elemento) elemento.remove();
  document.getElementById('num-integrantes').value = document.querySelectorAll('#lista-integrantes .fila-integrante').length;
}

let contadorMaterial = 1;

function agregarMaterial() {
  contadorMaterial++;
  const contenedor = document.getElementById('lista-materiales');
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
}

renderIntegrantes(2);
document.getElementById('lista-materiales').innerHTML = `
  <div class="fila-material" id="material-1">
    <div class="fila-num">1</div>
    <input type="text" placeholder="Nombre del material" class="nombre-material">
    <input type="text" placeholder="Núm. de registro" class="num-material" style="max-width:160px">
    <div></div>
  </div>`;

async function enviarRegistro() {
  const laboratorio = document.getElementById('laboratorio').value;
  if (!laboratorio) return mostrarMensaje('Seleccione un laboratorio.', 'error');

  const integrantes = Array.from(document.querySelectorAll('#lista-integrantes .fila-integrante')).map((fila) => ({
    nombre_completo: fila.querySelector('.nombre-integrante').value.trim(),
    matricula: fila.querySelector('.matricula-integrante').value.trim()
  }));

  const materiales = Array.from(document.querySelectorAll('#lista-materiales .fila-material')).map((fila) => ({
    nombre_material: fila.querySelector('.nombre-material').value.trim(),
    numero_registro: fila.querySelector('.num-material').value.trim()
  }));

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
