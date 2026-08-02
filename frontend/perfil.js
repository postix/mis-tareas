// Detectar si estamos accediendo desde localhost o desde la red
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : `http://${window.location.hostname}:3001`;
let currentUser = null;

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    window.location.href = 'login.html';
    return false;
  }
  
  currentUser = JSON.parse(user);
  actualizarUIUsuario();
  cargarPerfil();
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

async function cargarPerfil() {
  try {
    const response = await fetch(`${API_URL}/api/usuario/perfil`, {
      headers: getAuthHeaders()
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error fetching profile');
    
    const user = await response.json();
    currentUser = user;
    
    // Llenar el formulario
    document.getElementById('username').value = user.username;
    document.getElementById('email').value = user.email || '';
    document.getElementById('telefono').value = user.telefono || '';
    
  } catch (error) {
    mostrarError('Error al cargar el perfil');
    console.error('Error cargando perfil:', error);
  }
}

async function actualizarPerfil(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  
  try {
    const response = await fetch(`${API_URL}/api/usuario/perfil`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, telefono })
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    if (!response.ok) throw new Error('Error updating profile');
    
    const updatedUser = await response.json();
    currentUser = updatedUser;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    mostrarExito('Perfil actualizado correctamente');
    
  } catch (error) {
    mostrarError('Error al actualizar el perfil');
    console.error('Error actualizando perfil:', error);
  }
}

async function cambiarPassword(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (newPassword !== confirmPassword) {
    mostrarError('Las contraseñas nuevas no coinciden');
    return;
  }
  
  if (newPassword.length < 6) {
    mostrarError('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/usuario/perfil`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });
    
    if (response.status === 401) {
      handleTokenExpired();
      return;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error changing password');
    }
    
    // Limpiar formulario
    document.getElementById('passwordForm').reset();
    mostrarExito('Contraseña cambiada correctamente');
    
  } catch (error) {
    mostrarError(error.message || 'Error al cambiar la contraseña');
    console.error('Error cambiando contraseña:', error);
  }
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
document.getElementById('perfilForm').addEventListener('submit', actualizarPerfil);
document.getElementById('passwordForm').addEventListener('submit', cambiarPassword);
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});
document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

// Check auth on load
checkAuth();