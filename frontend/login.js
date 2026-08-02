// Detectar si estamos accediendo desde localhost o desde la red
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : `http://${window.location.hostname}:3001`;

async function login(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');
  
  if (!username || !password) {
    mostrarError('Por favor completa todos los campos');
    return;
  }
  
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    
    // Guardar token y datos de usuario
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    
    // Redirigir a la aplicación principal
    window.location.href = 'index.html';
    
  } catch (error) {
    mostrarError(error.message || 'Error al iniciar sesión');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Iniciar Sesión';
  }
}

function mostrarError(mensaje) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = mensaje;
  errorDiv.style.display = 'block';
}

// Verificar si ya está logueado
function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = 'index.html';
  }
}

// Event listeners
document.getElementById('loginForm').addEventListener('submit', login);

// Check auth on load
checkAuth();