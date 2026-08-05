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

async function cargarMaterialesActivas() {
  try {
    const res = await fetch(`${API}/registros/materiales`);
    const materiales = await res.json();
    const select = document.getElementById('material-seleccionado');
    select.innerHTML = `<option value="">-- Selecciona un material --</option>`;
    materiales.forEach((material) => {
      const option = document.createElement('option');
      option.value = material.id_material;
      option.textContent = material.nombre;
      select.appendChild(option);
    });
  } catch {
    const select = document.getElementById('material-seleccionado');
    select.innerHTML = `<option value="">No se pudieron cargar los materiales</option>`;
  }
}

renderIntegrantes(2);

// Manejo de múltiples materiales
function inicializarMateriales() {
  renderMaterialesSeleccionados();
  document.getElementById('btn-agregar-material').addEventListener('click', agregarMaterialALista);
}

function renderMaterialesSeleccionados() {
  const contenedor = document.getElementById('lista-materiales-seleccionados');
  const materiales = obtenerMateriailesDelForm();
  
  if (materiales.length === 0) {
    contenedor.innerHTML = '<p style="color:#999;font-size:13px;">No hay materiales agregados</p>';
    return;
  }
  
  contenedor.innerHTML = materiales.map((m, idx) => `
    <div class="material-fila" data-idx="${idx}">
      <div style="flex:1;">
        <strong>${m.nombre_material}</strong> (Reg: ${m.numero_registro})
      </div>
      <button type="button" class="btn-eliminar" onclick="eliminarMaterialDelForm(${idx})" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function agregarMaterialALista() {
  const selectMaterial = document.getElementById('material-seleccionado');
  const numeroRegistro = document.getElementById('numero-registro-material');
  
  const id_material = selectMaterial.value;
  const nombre_material = selectMaterial.options[selectMaterial.selectedIndex]?.text;
  const numero_registro = numeroRegistro.value.trim();
  
  if (!id_material) {
    mostrarMensaje('Selecciona un material.', 'error');
    return;
  }
  
  if (!numero_registro) {
    mostrarMensaje('Agrega el número de registro del material.', 'error');
    return;
  }
  
  // Obtener lista actual
  let materiales = JSON.parse(localStorage.getItem('_materiales_temp') || '[]');
  
  // Verificar duplicado
  if (materiales.some(m => m.id_material == id_material && m.numero_registro === numero_registro)) {
    mostrarMensaje('Este material con este número de registro ya está agregado.', 'error');
    return;
  }
  
  materiales.push({
    id_material: Number(id_material),
    nombre_material,
    numero_registro
  });
  
  localStorage.setItem('_materiales_temp', JSON.stringify(materiales));
  
  // Limpiar inputs
  selectMaterial.value = '';
  numeroRegistro.value = '';
  
  renderMaterialesSeleccionados();
  mostrarMensaje('Material agregado ✓', 'exito');
}

function eliminarMaterialDelForm(idx) {
  let materiales = JSON.parse(localStorage.getItem('_materiales_temp') || '[]');
  materiales.splice(idx, 1);
  localStorage.setItem('_materiales_temp', JSON.stringify(materiales));
  renderMaterialesSeleccionados();
}

function obtenerMateriailesDelForm() {
  return JSON.parse(localStorage.getItem('_materiales_temp') || '[]');
}

async function enviarRegistro() {
  const laboratorio = document.getElementById('laboratorio').value;
  if (!laboratorio) return mostrarMensaje('Seleccione un laboratorio.', 'error');

  const codigo_acceso = document.getElementById('codigo-acceso').value.trim();
  if (!codigo_acceso) return mostrarMensaje('Ingresa el código de acceso.', 'error');

  const materiales = obtenerMateriailesDelForm();
  if (materiales.length === 0) return mostrarMensaje('Agrega al menos un material.', 'error');

  const integrantes = Array.from(document.querySelectorAll('#lista-integrantes .fila-integrante')).map((fila) => ({
    nombre_completo: fila.querySelector('.nombre-integrante').value.trim(),
    matricula: fila.querySelector('.matricula-integrante').value.trim()
  }));

  for (const i of integrantes) {
    if (!i.nombre_completo || !i.matricula) {
      return mostrarMensaje('Complete nombre y matrícula de todos los integrantes.', 'error');
    }
  }

  try {
    const res = await fetch(`${API}/registros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ laboratorio, integrantes, materiales, codigo_acceso })
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
  document.getElementById('codigo-acceso').value = '';
  document.getElementById('material-seleccionado').value = '';
  document.getElementById('numero-registro-material').value = '';
  localStorage.removeItem('_materiales_temp');
  renderMaterialesSeleccionados();
}

cargarMaterialesActivas();
inicializarMateriales();

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

