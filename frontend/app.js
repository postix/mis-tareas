// Detectar si estamos accediendo desde localhost o desde la red
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : `http://${window.location.hostname}:3001`;
let tareas = [];
let currentUser = null;

// Verificar autenticación
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    window.location.href = 'login.html';
    return false;
  }
  
  currentUser = JSON.parse(user);
  actualizarUIUsuario();
  return true;
}

function actualizarUIUsuario() {
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.username;
    
    // Mostrar botón de admin si es administrador
    const adminItem = document.querySelector('.admin-item');
    if (currentUser.es_admin) {
      adminItem.style.display = 'flex';
    } else {
      adminItem.style.display = 'none';
    }
  }
}

async function logout() {
  try {
    const token = localStorage.getItem('token');
    
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': token }
    });
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token
  };
}

function handleTokenExpired() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

async function cargarTareas() {
  try {
    mostrarCargando(true);
    const response = await fetch(`${API_URL}/api/tareas`, {
      headers: getAuthHeaders()
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error fetching tareas');
    
    tareas = await response.json();
    renderizarTareas();
    actualizarEstadisticas();
    ocultarError();
  } catch (error) {
    mostrarError('Error al cargar las tareas');
    console.error('Error cargando tareas:', error);
  } finally {
    mostrarCargando(false);
  }
}

async function crearTarea(e) {
  e.preventDefault();
  const titulo = document.getElementById('tituloInput').value.trim();
  const descripcion = document.getElementById('descripcionInput').value.trim();
  
  if (!titulo) return;

  try {
    const response = await fetch(`${API_URL}/api/tareas`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ titulo, descripcion })
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error creating tarea');
    
    const nuevaTarea = await response.json();
    tareas.unshift(nuevaTarea);
    renderizarTareas();
    actualizarEstadisticas();
    
    document.getElementById('tituloInput').value = '';
    document.getElementById('descripcionInput').value = '';
    ocultarError();
  } catch (error) {
    mostrarError('Error al crear la tarea');
    console.error('Error creando tarea:', error);
  }
}

async function actualizarTarea(id, datosActualizados) {
  try {
    const response = await fetch(`${API_URL}/api/tareas/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(datosActualizados)
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error updating tarea');
    
    const tareaActualizada = await response.json();
    const index = tareas.findIndex(t => t.id === id);
    if (index !== -1) {
      tareas[index] = tareaActualizada;
      renderizarTareas();
      actualizarEstadisticas();
    }
    ocultarError();
  } catch (error) {
    mostrarError('Error al actualizar la tarea');
    console.error('Error actualizando tarea:', error);
  }
}

async function toggleCompletada(tarea) {
  try {
    const response = await fetch(`${API_URL}/api/tareas/${tarea.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...tarea, completada: !tarea.completada })
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error updating tarea');
    
    const tareaActualizada = await response.json();
    const index = tareas.findIndex(t => t.id === tarea.id);
    if (index !== -1) {
      tareas[index] = tareaActualizada;
      renderizarTareas();
      actualizarEstadisticas();
    }
    ocultarError();
  } catch (error) {
    mostrarError('Error al actualizar la tarea');
    console.error('Error actualizando tarea:', error);
  }
}

async function eliminarTarea(id) {
  try {
    const response = await fetch(`${API_URL}/api/tareas/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error deleting tarea');
    
    tareas = tareas.filter(t => t.id !== id);
    renderizarTareas();
    actualizarEstadisticas();
    ocultarError();
  } catch (error) {
    mostrarError('Error al eliminar la tarea');
    console.error('Error eliminando tarea:', error);
  }
}

function renderizarTareas() {
  const lista = document.getElementById('tareas-lista');
  const sinTareas = document.getElementById('sin-tareas');
  
  lista.innerHTML = '';
  
  if (tareas.length === 0) {
    sinTareas.style.display = 'block';
    return;
  }
  
  sinTareas.style.display = 'none';
  
  tareas.forEach(tarea => {
    const card = document.createElement('div');
    card.className = `tarea-card ${tarea.completada ? 'completada' : ''}`;
    card.dataset.id = tarea.id;
    
    card.innerHTML = `
      <div class="tarea-header">
        <input type="checkbox" class="checkbox" ${tarea.completada ? 'checked' : ''}>
        <h3 class="tarea-titulo">${escapeHtml(tarea.titulo)}</h3>
      </div>
      ${tarea.descripcion ? `<p class="tarea-descripcion">${escapeHtml(tarea.descripcion)}</p>` : ''}
      <div class="tarea-meta">
        <span class="fecha">Creada: ${new Date(tarea.creada_en).toLocaleDateString('es-ES')}</span>
      </div>
      <div class="tarea-acciones">
        <button class="btn btn-edit" ${tarea.completada ? 'disabled' : ''}>Editar</button>
        <button class="btn btn-delete">Eliminar</button>
      </div>
    `;
    
    // Event listeners
    const checkbox = card.querySelector('.checkbox');
    checkbox.addEventListener('change', () => toggleCompletada(tarea));
    
    const editBtn = card.querySelector('.btn-edit');
    editBtn.addEventListener('click', () => iniciarEdicion(tarea, card));
    
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => eliminarTarea(tarea.id));
    
    lista.appendChild(card);
  });
}

function iniciarEdicion(tarea, card) {
  const titulo = tarea.titulo;
  const descripcion = tarea.descripcion || '';
  
  card.innerHTML = `
    <form class="edit-form">
      <input type="text" class="input-titulo edit-titulo" value="${escapeHtml(titulo)}" required>
      <textarea class="input-descripcion edit-descripcion" rows="2">${escapeHtml(descripcion)}</textarea>
      <div class="edit-buttons">
        <button type="submit" class="btn btn-success">Guardar</button>
        <button type="button" class="btn btn-secondary cancelar">Cancelar</button>
      </div>
    </form>
  `;
  
  const form = card.querySelector('.edit-form');
  const cancelarBtn = card.querySelector('.cancelar');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoTitulo = card.querySelector('.edit-titulo').value.trim();
    const nuevaDescripcion = card.querySelector('.edit-descripcion').value.trim();
    
    if (!nuevoTitulo) return;
    
    await actualizarTarea(tarea.id, { titulo: nuevoTitulo, descripcion: nuevaDescripcion });
  });
  
  cancelarBtn.addEventListener('click', () => {
    renderizarTareas();
  });
}

function actualizarEstadisticas() {
  const pendientes = tareas.filter(t => !t.completada).length;
  const completadas = tareas.filter(t => t.completada).length;
  
  document.getElementById('pendientes').textContent = pendientes;
  document.getElementById('completadas').textContent = completadas;
}

function mostrarCargando(mostrar) {
  document.getElementById('cargando').style.display = mostrar ? 'block' : 'none';
}

function mostrarError(mensaje) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = mensaje;
  errorDiv.style.display = 'block';
}

function ocultarError() {
  document.getElementById('error').style.display = 'none';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Sidebar toggle functionality
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

// Event listeners
document.getElementById('tareaForm').addEventListener('submit', crearTarea);
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});
document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

// Check auth and initial load
if (checkAuth()) {
  cargarTareas();
}