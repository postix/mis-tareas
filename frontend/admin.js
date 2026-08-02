// Detectar si estamos accediendo desde localhost o desde la red
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : `http://${window.location.hostname}:3001`;
let currentUser = null;
let usuarios = [];

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    window.location.href = 'login.html';
    return false;
  }
  
  currentUser = JSON.parse(user);
  
  // Verificar que sea admin
  if (!currentUser.es_admin) {
    window.location.href = 'index.html';
    return false;
  }
  
  actualizarUIUsuario();
  cargarUsuarios();
  return true;
}

function actualizarUIUsuario() {
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.username;
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

async function cargarUsuarios() {
  try {
    mostrarCargando(true);
    const response = await fetch(`${API_URL}/api/admin/usuarios`, {
      headers: getAuthHeaders()
    });
    
    if (response.status === 401 || response.status === 403) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error fetching users');
    
    usuarios = await response.json();
    renderizarUsuarios();
    ocultarError();
  } catch (error) {
    mostrarError('Error al cargar los usuarios');
    console.error('Error cargando usuarios:', error);
  } finally {
    mostrarCargando(false);
  }
}

function renderizarUsuarios() {
  const lista = document.getElementById('usuarios-lista');
  lista.innerHTML = '';
  
  if (usuarios.length === 0) {
    lista.innerHTML = '<div class="sin-usuarios">No hay usuarios registrados</div>';
    return;
  }
  
  usuarios.forEach(usuario => {
    const card = document.createElement('div');
    card.className = `usuario-card ${!usuario.activo ? 'inactivo' : ''}`;
    
    card.innerHTML = `
      <div class="usuario-header">
        <div class="usuario-info">
          <h3 class="usuario-nombre">${escapeHtml(usuario.username)}</h3>
          <span class="usuario-badge ${usuario.es_admin ? 'admin' : 'user'}">
            ${usuario.es_admin ? 'Administrador' : 'Usuario'}
          </span>
          <span class="usuario-badge ${usuario.activo ? 'activo' : 'inactivo'}">
            ${usuario.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div class="usuario-acciones">
          <button class="btn btn-edit" onclick="editarUsuario(${usuario.id})">Editar</button>
          ${usuario.id !== currentUser.id ? `<button class="btn btn-delete" onclick="eliminarUsuario(${usuario.id})">Eliminar</button>` : ''}
        </div>
      </div>
      <div class="usuario-detalles">
        <p><strong>Email:</strong> ${escapeHtml(usuario.email || 'No especificado')}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(usuario.telefono || 'No especificado')}</p>
        <p><strong>Creado:</strong> ${new Date(usuario.creado_en).toLocaleDateString('es-ES')}</p>
      </div>
    `;
    
    lista.appendChild(card);
  });
}

function mostrarModal(usuario = null) {
  const modal = document.getElementById('usuarioModal');
  const form = document.getElementById('usuarioForm');
  const title = document.getElementById('modalTitle');
  
  form.reset();
  
  if (usuario) {
    title.textContent = 'Editar Usuario';
    document.getElementById('userId').value = usuario.id;
    document.getElementById('modalUsername').value = usuario.username;
    document.getElementById('modalPassword').value = '';
    document.getElementById('modalPassword').required = false;
    document.getElementById('modalEmail').value = usuario.email || '';
    document.getElementById('modalTelefono').value = usuario.telefono || '';
    document.getElementById('modalEsAdmin').checked = usuario.es_admin;
    document.getElementById('modalActivo').checked = usuario.activo;
  } else {
    title.textContent = 'Crear Usuario';
    document.getElementById('userId').value = '';
    document.getElementById('modalPassword').required = true;
    document.getElementById('modalActivo').checked = true;
  }
  
  modal.style.display = 'block';
}

function ocultarModal() {
  document.getElementById('usuarioModal').style.display = 'none';
}

async function guardarUsuario(e) {
  e.preventDefault();
  
  const userId = document.getElementById('userId').value;
  const username = document.getElementById('modalUsername').value.trim();
  const password = document.getElementById('modalPassword').value;
  const email = document.getElementById('modalEmail').value.trim();
  const telefono = document.getElementById('modalTelefono').value.trim();
  const esAdmin = document.getElementById('modalEsAdmin').checked;
  const activo = document.getElementById('modalActivo').checked;
  
  if (!username) {
    mostrarError('El usuario es requerido');
    return;
  }
  
  if (!userId && password.length < 6) {
    mostrarError('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    let response;
    
    if (userId) {
      // Editar usuario existente
      const data = {
        email,
        telefono,
        es_admin: esAdmin,
        activo
      };
      
      if (password) {
        data.password = password;
      }
      
      response = await fetch(`${API_URL}/api/admin/usuarios/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
    } else {
      // Crear nuevo usuario
      response = await fetch(`${API_URL}/api/admin/usuarios`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username,
          password,
          email,
          telefono,
          es_admin: esAdmin
        })
      });
    }
    
    if (response.status === 401 || response.status === 403) {
      handleTokenExpired();
      return;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error saving user');
    }
    
    ocultarModal();
    await cargarUsuarios();
    mostrarExito(userId ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
    
  } catch (error) {
    mostrarError(error.message || 'Error al guardar el usuario');
    console.error('Error guardando usuario:', error);
  }
}

async function eliminarUsuario(id) {
  try {
    const response = await fetch(`${API_URL}/api/admin/usuarios/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (response.status === 401 || response.status === 403) {
      handleTokenExpired();
      return;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error deleting user');
    }
    
    await cargarUsuarios();
    mostrarExito('Usuario eliminado correctamente');
    
  } catch (error) {
    mostrarError(error.message || 'Error al eliminar el usuario');
    console.error('Error eliminando usuario:', error);
  }
}

// Función global para editar usuario
window.editarUsuario = function(id) {
  const usuario = usuarios.find(u => u.id === id);
  if (usuario) {
    mostrarModal(usuario);
  }
};

// Función global para eliminar usuario
window.eliminarUsuario = function(id) {
  eliminarUsuario(id);
};

function mostrarCargando(mostrar) {
  document.getElementById('cargando').style.display = mostrar ? 'block' : 'none';
}

function mostrarError(mensaje) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = mensaje;
  errorDiv.style.display = 'block';
  
  const successDiv = document.getElementById('success');
  successDiv.style.display = 'none';
}

function mostrarExito(mensaje) {
  const successDiv = document.getElementById('success');
  successDiv.textContent = mensaje;
  successDiv.style.display = 'block';
  
  const errorDiv = document.getElementById('error');
  errorDiv.style.display = 'none';
}

function ocultarError() {
  document.getElementById('error').style.display = 'none';
  document.getElementById('success').style.display = 'none';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
document.getElementById('usuarioForm').addEventListener('submit', guardarUsuario);
document.getElementById('crearUsuarioBtn').addEventListener('click', () => mostrarModal());
document.getElementById('closeModal').addEventListener('click', ocultarModal);
document.getElementById('cancelModal').addEventListener('click', ocultarModal);
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});
document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (e) => {
  const modal = document.getElementById('usuarioModal');
  if (e.target === modal) {
    ocultarModal();
  }
});

// Check auth on load
checkAuth();