const API = `${window.location.origin}/api`;
const token = localStorage.getItem('adminToken');

if (!token) window.location.href = '/login';

document.getElementById('nombre-admin').textContent =
  localStorage.getItem('adminNombre') || 'Administrador';

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': token };
}

async function cargarStats() {
  try {
    const res = await fetch(`${API}/registros/stats`, { headers: authHeaders() });
    if (res.status === 401) { cerrarSesion(); return; }
    const d = await res.json();
    document.getElementById('stat-hoy').textContent = d.registros_hoy;
    document.getElementById('stat-labs').textContent = d.labs_activos;
    document.getElementById('stat-materiales').textContent = d.materiales_total;
    document.getElementById('stat-equipos').textContent = d.equipos_atendidos;
  } catch {}
}

async function cargarRegistros() {
  const busqueda = document.getElementById('f-busqueda').value.trim();
  const laboratorio = document.getElementById('f-laboratorio').value;
  const fecha = document.getElementById('f-fecha').value;

  const params = new URLSearchParams();
  if (busqueda) params.append('busqueda', busqueda);
  if (laboratorio) params.append('laboratorio', laboratorio);
  if (fecha) params.append('fecha', fecha);

  try {
    const res = await fetch(`${API}/registros?${params}`, { headers: authHeaders() });
    if (res.status === 401) { cerrarSesion(); return; }
    const registros = await res.json();
    renderTabla(registros);
  } catch {
    document.getElementById('tbody-registros').innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:#c00;">Error al cargar registros</td></tr>';
  }
}

function renderTabla(registros) {
  const tbody = document.getElementById('tbody-registros');
  const msgVacio = document.getElementById('msg-vacio');

  if (registros.length === 0) {
    tbody.innerHTML = '';
    msgVacio.style.display = 'block';
    return;
  }
  msgVacio.style.display = 'none';

  tbody.innerHTML = registros.map(r => {
    const badgeClass = r.estado === 'Completado' ? 'badge-completado'
      : r.estado === 'En proceso' ? 'badge-proceso' : 'badge-cancelado';
    const fecha = new Date(r.fecha).toLocaleDateString('es-MX');
    const hora = r.hora.slice(0, 5);
    return `<tr onclick="verDetalle(${r.id})">
      <td class="folio-link">${r.folio}</td>
      <td>${fecha}</td>
      <td>${hora}</td>
      <td>${r.laboratorio}</td>
      <td style="text-align:center">${r.codigo_acceso || ''}</td>
      <td style="text-align:center">${r.numero_integrantes}</td>
      <td style="text-align:center">${r.total_materiales}</td>
      <td><span class="badge ${badgeClass}">${r.estado}</span></td>
      <td><button class="btn-ver" onclick="event.stopPropagation();verDetalle(${r.id})">Ver detalle</button></td>
    </tr>`;
  }).join('');
}

async function verDetalle(id) {
  const panel = document.getElementById('detalle-contenido');
  panel.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;padding:20px;">Cargando...</p>';

  try {
    const res = await fetch(`${API}/registros/${id}`, { headers: authHeaders() });
    const r = await res.json();

    const fecha = new Date(r.fecha).toLocaleDateString('es-MX');
    const hora = r.hora.slice(0, 5);
    const badgeClass = r.estado === 'Completado' ? 'badge-completado'
      : r.estado === 'En proceso' ? 'badge-proceso' : 'badge-cancelado';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
        <div class="detalle-folio">${r.folio}</div>
        <span class="badge ${badgeClass}">${r.estado}</span>
      </div>

      <div class="detalle-meta">
        <div class="detalle-meta-item"><label>Laboratorio</label>${r.laboratorio}</div>
        <div class="detalle-meta-item"><label>Código</label>${r.codigo_acceso || 'N/A'}</div>
        <div class="detalle-meta-item"><label>Integrantes</label>${r.numero_integrantes}</div>
        <div class="detalle-meta-item"><label>Fecha</label>${fecha}</div>
        <div class="detalle-meta-item"><label>Hora</label>${hora}</div>
      </div>

      <div class="subtitulo">Integrantes</div>
      <table class="detalle-tabla">
        <thead><tr><th>#</th><th>Nombre completo</th><th>Matrícula</th></tr></thead>
        <tbody>
          ${r.integrantes.map((i, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${i.nombre_completo}</td>
              <td>${i.matricula}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div class="subtitulo">Materiales utilizados</div>
      <table class="detalle-tabla">
        <thead><tr><th>#</th><th>Material</th><th>Núm. de registro</th></tr></thead>
        <tbody>
          ${r.materiales.map((m, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${m.nombre_material}</td>
              <td>${m.numero_registro}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <p style="font-size:11px;color:#888;margin-top:14px;background:#f0f7ff;padding:8px;border-radius:6px;">
        ℹ El administrador puede visualizar día, hora y laboratorio del registro.
      </p>`;
  } catch {
    panel.innerHTML = '<p style="color:#c00;font-size:13px;">Error al cargar el detalle.</p>';
  }
}

function limpiarFiltros() {
  document.getElementById('f-busqueda').value = '';
  document.getElementById('f-laboratorio').value = '';
  document.getElementById('f-fecha').value = '';
  cargarRegistros();
}

async function generarCodigoAcceso() {
  try {
    const res = await fetch(`${API}/registros/codigos`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ expiracion_horas: 2 })
    });

    if (res.status === 401) { cerrarSesion(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo generar el código');

    document.getElementById('nuevo-codigo').value = data.codigo;
    document.getElementById('codigo-expiracion').textContent = `Expira el ${data.expiracion_formateada}`;
    document.getElementById('codigo-estado').textContent = `Estado: ${data.estado || 'Activo'}`;
    localStorage.setItem('admin_last_codigo', data.codigo);
    localStorage.setItem('admin_last_codigo_expiracion_formateada', data.expiracion_formateada || '');
    localStorage.setItem('admin_last_codigo_expiracion_raw', data.expiracion || '');
    localStorage.setItem('admin_last_codigo_estado', data.estado || 'Activo');

    mostrarMensajeAdmin('Código generado correctamente', 'exito');
    await cargarCodigosActivos();
    await cargarMaterialesAdmin();
  } catch (err) {
    mostrarMensajeAdmin('Error: ' + err.message, 'error');
  }
}

async function cargarCodigosActivos() {
  try {
    const res = await fetch(`${API}/registros/codigos`, { headers: authHeaders() });
    if (res.status === 401) { cerrarSesion(); return; }
    const codigos = await res.json();
    renderCodigosActivos(codigos);
  } catch (err) {
    console.error('Error cargando códigos:', err);
    const el = document.getElementById('codigos-lista');
    if (el) el.innerHTML = '<p style="color:#c00;">Error al cargar códigos.</p>';
  }
}

function renderCodigosActivos(codigos) {
  const contenedor = document.getElementById('codigos-lista');
  if (!contenedor) return;

  if (!codigos || codigos.length === 0) {
    contenedor.innerHTML = '<p style="color:#555; margin-top:12px;">No hay códigos activos.</p>';
    return;
  }

  contenedor.innerHTML = codigos.map((codigo) => {
    const expiracion = codigo.expiracion_formateada || codigo.expiracion || 'Sin expiración';
    return `
      <div class="codigo-item">
        <div><strong>${codigo.codigo}</strong> — <span>${expiracion}</span></div>
        <div class="codigo-estado">${codigo.estado}</div>
      </div>
    `;
  }).join('');
}

async function cargarMaterialesAdmin() {
  try {
    const res = await fetch(`${API}/registros/materiales/gestion`, { headers: authHeaders() });
    if (res.status === 401) { cerrarSesion(); return; }
    const materiales = await res.json();
    renderMaterialesAdmin(materiales);
  } catch (err) {
    console.error('Error cargando materiales:', err);
    const el = document.getElementById('materiales-lista');
    if (el) el.innerHTML = '<p style="color:#c00;">Error al cargar materiales.</p>';
  }
}

function renderMaterialesAdmin(materiales) {
  const contenedor = document.getElementById('materiales-lista');
  if (!contenedor) {
    console.error('materiales-lista element not found');
    return;
  }
  
  if (!materiales || !Array.isArray(materiales)) {
    contenedor.innerHTML = '<p style="color:#999;">Sin materiales</p>';
    return;
  }
  
  if (materiales.length === 0) {
    contenedor.innerHTML = '<p style="color:#555; margin-top:12px;">No hay materiales registrados.</p>';
    return;
  }

  contenedor.innerHTML = materiales.map((material) => `
    <div class="material-item">
      <span>${material.nombre}</span>
      <button type="button" class="btn-eliminar" onclick="eliminarMaterial(${material.id_material})">Eliminar</button>
    </div>
  `).join('');
}

async function crearMaterial() {
  const nombre = document.getElementById('material-nuevo').value.trim();
  if (!nombre) {
    mostrarMensajeAdmin('Escribe el nombre del material.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/registros/materiales`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nombre })
    });
    if (res.status === 401) { cerrarSesion(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo crear el material');

    document.getElementById('material-nuevo').value = '';
    await cargarMaterialesAdmin();
    mostrarMensajeAdmin('Material agregado correctamente.', 'exito');
  } catch (err) {
    mostrarMensajeAdmin('Error: ' + err.message, 'error');
  }
}

async function eliminarMaterial(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este material?')) {
    return;
  }
  
  try {
    const res = await fetch(`${API}/registros/materiales/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.status === 401) { cerrarSesion(); return; }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'No se pudo eliminar el material');
    }
    
    await cargarMaterialesAdmin();
    mostrarMensajeAdmin('Material eliminado.', 'exito');
  } catch (err) {
    mostrarMensajeAdmin('Error: ' + err.message, 'error');
  }
}

function mostrarMensajeAdmin(texto, tipo) {
  const el = document.getElementById('codigo-mensaje');
  el.textContent = texto;
  el.className = `mensaje ${tipo}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function formatCodigoEstado(estado, expiracion) {
  const fechaExpiracion = expiracion && expiracion.includes('T') ? new Date(expiracion) : null;
  const isExpired = fechaExpiracion ? fechaExpiracion.getTime() < Date.now() : false;
  if (isExpired) return 'Estado: Expirado';
  return `Estado: ${estado || 'Activo'}`;
}

function formatLocalDateTime(dateValue) {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City'
  });
}

function loadSavedCodigoGenerado() {
  const codigo = localStorage.getItem('admin_last_codigo');
  const expiracionFormateada = localStorage.getItem('admin_last_codigo_expiracion_formateada');
  const expiracionRaw = localStorage.getItem('admin_last_codigo_expiracion_raw');
  const estado = localStorage.getItem('admin_last_codigo_estado');
  if (!codigo) return;

  document.getElementById('nuevo-codigo').value = codigo;
  document.getElementById('codigo-expiracion').textContent = expiracionFormateada
    ? `Expira el ${expiracionFormateada}`
    : expiracionRaw ? `Expira el ${formatLocalDateTime(expiracionRaw)}` : '';
  document.getElementById('codigo-estado').textContent = formatCodigoEstado(estado, expiracionRaw);
}

function cerrarSesion() {
  fetch(`${API}/auth/logout`, { method: 'POST', headers: authHeaders() });
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminNombre');
  window.location.href = '/login';
}

cargarStats();
cargarRegistros();
cargarMaterialesAdmin();
cargarCodigosActivos();
loadSavedCodigoGenerado();

