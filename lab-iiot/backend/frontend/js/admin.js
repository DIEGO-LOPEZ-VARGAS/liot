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
    return `<tr onclick="verDetalle(${r.id_registro})">
      <td class="folio-link">${r.folio}</td>
      <td>${fecha}</td>
      <td>${hora}</td>
      <td>${r.laboratorio}</td>
      <td style="text-align:center">${r.numero_integrantes}</td>
      <td style="text-align:center">${r.total_materiales}</td>
      <td><span class="badge ${badgeClass}">${r.estado}</span></td>
      <td><button class="btn-ver" onclick="event.stopPropagation();verDetalle(${r.id_registro})">Ver detalle</button></td>
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

function cerrarSesion() {
  fetch(`${API}/auth/logout`, { method: 'POST', headers: authHeaders() });
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminNombre');
  window.location.href = '/login';
}

cargarStats();
cargarRegistros();
