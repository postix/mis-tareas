from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from datetime import datetime, timedelta
import hashlib
import jwt

app = Flask(__name__)
CORS(app)

# Clave secreta para JWT
JWT_SECRET = 'tu_clave_secreta_super_segura_jwt_123456'
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 1

# Configuración de la base de datos MySQL remota
DB_CONFIG = {
    'host': '192.168.1.10',
    'user': 'cpadilla',
    'password': 'isla29usted',
    'database': 'mis_tareas',
    'port': 3306
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        raise

def hash_password(password):
    """Hash de contraseña usando SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    """Verificar contraseña"""
    return hash_password(password) == hashed

def generate_jwt_token(user_id, username, es_admin):
    """Generar token JWT con expiración de 1 hora"""
    payload = {
        'user_id': user_id,
        'username': username,
        'es_admin': es_admin,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token):
    """Verificar y decodificar token JWT"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def init_db():
    try:
        # Primero conectarse sin especificar la base de datos para crearla si no existe
        conn_config = DB_CONFIG.copy()
        conn_config.pop('database', None)
        
        conn = mysql.connector.connect(**conn_config)
        cursor = conn.cursor()
        
        # Crear la base de datos si no existe
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        conn.commit()
        conn.close()
        
        # Ahora conectarse a la base de datos específica
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Crear tabla de usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                telefono VARCHAR(20),
                es_admin BOOLEAN DEFAULT FALSE,
                activo BOOLEAN DEFAULT TRUE,
                token VARCHAR(255),
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ''')
        
        # Agregar columna token si no existe
        try:
            cursor.execute('ALTER TABLE usuarios ADD COLUMN token VARCHAR(255)')
        except Error as e:
            if "Duplicate column name" not in str(e):
                raise
        
        # Modificar tabla de tareas para incluir user_id
        try:
            cursor.execute('ALTER TABLE tareas ADD COLUMN user_id INT')
            cursor.execute('ALTER TABLE tareas ADD FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE')
        except Error as e:
            if "Duplicate column name" not in str(e):
                raise
        
        # Crear usuario administrador por defecto si no existe
        cursor.execute('SELECT COUNT(*) FROM usuarios WHERE username = %s', ('cpadilla',))
        admin_exists = cursor.fetchone()[0]
        
        if admin_exists == 0:
            admin_password = hash_password('123456789')
            cursor.execute('''
                INSERT INTO usuarios (username, password, email, es_admin)
                VALUES (%s, %s, %s, %s)
            ''', ('cpadilla', admin_password, 'admin@sistema.com', True))
            print("Administrador por defecto creado: cpadilla / 123456789")
        
        conn.commit()
        conn.close()
        print("Database initialized successfully")
    except Error as e:
        print(f"Error initializing database: {e}")
        # No lanzar error si es por ALTER TABLE (columna ya existe)
        if "Duplicate column name" not in str(e):
            raise

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Server is running'})

# Rutas de autenticación
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM usuarios WHERE username = %s AND activo = TRUE', (username,))
        user = cursor.fetchone()
        conn.close()
        
        if not user or not verify_password(password, user['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Generar token JWT
        token = generate_jwt_token(user['id'], user['username'], user['es_admin'])
        
        # No devolver la contraseña
        user.pop('password', None)
        user['token'] = token
        
        return jsonify(user)
    except Error as e:
        print(f"Error during login: {e}")
        return jsonify({'error': 'Error during login'}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    # Con JWT, el logout se maneja en el cliente eliminando el token
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    try:
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id, username, email, telefono, es_admin, activo, creado_en FROM usuarios WHERE id = %s', (payload['user_id'],))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user)
    except Error as e:
        print(f"Error getting current user: {e}")
        return jsonify({'error': 'Error getting current user'}), 500

def require_auth(f):
    """Decorador para requerir autenticación con JWT"""
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        request.current_user = {
            'id': payload['user_id'],
            'username': payload['username'],
            'es_admin': payload['es_admin']
        }
        return f(*args, **kwargs)
    
    wrapper.__name__ = f.__name__
    return wrapper

def require_admin(f):
    """Decorador para requerir rol de administrador con JWT"""
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        if not payload['es_admin']:
            return jsonify({'error': 'Admin privileges required'}), 403
        
        request.current_user = {
            'id': payload['user_id'],
            'username': payload['username'],
            'es_admin': payload['es_admin']
        }
        return f(*args, **kwargs)
    
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/api/tareas', methods=['GET'])
@require_auth
def get_tareas():
    try:
        user_id = request.current_user['id']
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Si es admin, puede ver todas las tareas, si no, solo las suyas
        if request.current_user['es_admin']:
            cursor.execute('SELECT * FROM tareas ORDER BY creada_en DESC')
        else:
            cursor.execute('SELECT * FROM tareas WHERE user_id = %s ORDER BY creada_en DESC', (user_id,))
        
        tareas = cursor.fetchall()
        conn.close()
        
        # Convertir booleanos de MySQL a JavaScript boolean
        for tarea in tareas:
            tarea['completada'] = bool(tarea['completada'])
        
        return jsonify(tareas)
    except Error as e:
        print(f"Error fetching tareas: {e}")
        return jsonify({'error': 'Error fetching tareas'}), 500

@app.route('/api/tareas', methods=['POST'])
@require_auth
def create_tarea():
    try:
        user_id = request.current_user['id']
        data = request.get_json()
        titulo = data.get('titulo')
        descripcion = data.get('descripcion', '')
        
        if not titulo:
            return jsonify({'error': 'Titulo is required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            'INSERT INTO tareas (titulo, descripcion, user_id) VALUES (%s, %s, %s)',
            (titulo, descripcion, user_id)
        )
        conn.commit()
        tarea_id = cursor.lastrowid
        conn.close()
        
        # Fetch the created tarea
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM tareas WHERE id = %s', (tarea_id,))
        tarea = cursor.fetchone()
        conn.close()
        
        tarea['completada'] = bool(tarea['completada'])
        
        return jsonify(tarea), 201
    except Error as e:
        print(f"Error creating tarea: {e}")
        return jsonify({'error': 'Error creating tarea'}), 500

@app.route('/api/tareas/<int:id>', methods=['PUT'])
@require_auth
def update_tarea(id):
    try:
        user_id = request.current_user['id']
        is_admin = request.current_user['es_admin']
        data = request.get_json()
        titulo = data.get('titulo')
        descripcion = data.get('descripcion')
        completada = data.get('completada')
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verificar que la tarea pertenezca al usuario o que sea admin
        if not is_admin:
            cursor.execute('SELECT user_id FROM tareas WHERE id = %s', (id,))
            tarea = cursor.fetchone()
            if not tarea or tarea['user_id'] != user_id:
                conn.close()
                return jsonify({'error': 'Tarea not found or access denied'}), 404
        
        # Build dynamic update query
        updates = []
        values = []
        
        if titulo is not None:
            updates.append('titulo = %s')
            values.append(titulo)
        if descripcion is not None:
            updates.append('descripcion = %s')
            values.append(descripcion)
        if completada is not None:
            updates.append('completada = %s')
            values.append(1 if completada else 0)
        
        if not updates:
            return jsonify({'error': 'No fields to update'}), 400
        
        values.append(id)
        
        query = f"UPDATE tareas SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Tarea not found'}), 404
        
        # Fetch the updated tarea
        cursor.execute('SELECT * FROM tareas WHERE id = %s', (id,))
        tarea = cursor.fetchone()
        conn.close()
        
        tarea['completada'] = bool(tarea['completada'])
        
        return jsonify(tarea)
    except Error as e:
        print(f"Error updating tarea: {e}")
        return jsonify({'error': 'Error updating tarea'}), 500

@app.route('/api/tareas/<int:id>', methods=['DELETE'])
@require_auth
def delete_tarea(id):
    try:
        user_id = request.current_user['id']
        is_admin = request.current_user['es_admin']
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verificar que la tarea pertenezca al usuario o que sea admin
        if not is_admin:
            cursor.execute('SELECT user_id FROM tareas WHERE id = %s', (id,))
            tarea = cursor.fetchone()
            if not tarea or tarea['user_id'] != user_id:
                conn.close()
                return jsonify({'error': 'Tarea not found or access denied'}), 404
        
        cursor.execute('DELETE FROM tareas WHERE id = %s', (id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Tarea not found'}), 404
        
        conn.close()
        return jsonify({'message': 'Tarea deleted successfully'})
    except Error as e:
        print(f"Error deleting tarea: {e}")
        return jsonify({'error': 'Error deleting tarea'}), 500

# Rutas de gestión de usuarios (CRUD) - Solo admin
@app.route('/api/admin/usuarios', methods=['GET'])
@require_admin
def get_all_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id, username, email, telefono, es_admin, activo, creado_en FROM usuarios ORDER BY creado_en DESC')
        users = cursor.fetchall()
        conn.close()
        
        return jsonify(users)
    except Error as e:
        print(f"Error fetching users: {e}")
        return jsonify({'error': 'Error fetching users'}), 500

@app.route('/api/admin/usuarios', methods=['POST'])
@require_admin
def create_user():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email', '')
        telefono = data.get('telefono', '')
        es_admin = data.get('es_admin', False)
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        hashed_password = hash_password(password)
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute('''
                INSERT INTO usuarios (username, password, email, telefono, es_admin)
                VALUES (%s, %s, %s, %s, %s)
            ''', (username, hashed_password, email, telefono, es_admin))
            conn.commit()
            user_id = cursor.lastrowid
        except Error as e:
            if "Duplicate entry" in str(e):
                conn.close()
                return jsonify({'error': 'Username already exists'}), 400
            raise
        
        # Fetch the created user
        cursor.execute('SELECT id, username, email, telefono, es_admin, activo, creado_en FROM usuarios WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        return jsonify(user), 201
    except Error as e:
        print(f"Error creating user: {e}")
        return jsonify({'error': 'Error creating user'}), 500

@app.route('/api/admin/usuarios/<int:id>', methods=['PUT'])
@require_admin
def update_user(id):
    try:
        data = request.get_json()
        email = data.get('email')
        telefono = data.get('telefono')
        es_admin = data.get('es_admin')
        activo = data.get('activo')
        password = data.get('password')
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        
        if email is not None:
            updates.append('email = %s')
            values.append(email)
        if telefono is not None:
            updates.append('telefono = %s')
            values.append(telefono)
        if es_admin is not None:
            updates.append('es_admin = %s')
            values.append(es_admin)
        if activo is not None:
            updates.append('activo = %s')
            values.append(activo)
        if password is not None:
            updates.append('password = %s')
            values.append(hash_password(password))
        
        if not updates:
            return jsonify({'error': 'No fields to update'}), 400
        
        values.append(id)
        
        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Fetch the updated user
        cursor.execute('SELECT id, username, email, telefono, es_admin, activo, creado_en FROM usuarios WHERE id = %s', (id,))
        user = cursor.fetchone()
        conn.close()
        
        return jsonify(user)
    except Error as e:
        print(f"Error updating user: {e}")
        return jsonify({'error': 'Error updating user'}), 500

@app.route('/api/admin/usuarios/<int:id>', methods=['DELETE'])
@require_admin
def delete_user(id):
    try:
        # No permitir eliminar al usuario actual
        if id == request.current_user['id']:
            return jsonify({'error': 'Cannot delete yourself'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('DELETE FROM usuarios WHERE id = %s', (id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        conn.close()
        return jsonify({'message': 'User deleted successfully'})
    except Error as e:
        print(f"Error deleting user: {e}")
        return jsonify({'error': 'Error deleting user'}), 500

# Rutas de perfil de usuario
@app.route('/api/usuario/perfil', methods=['GET'])
@require_auth
def get_profile():
    try:
        user_id = request.current_user['id']
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id, username, email, telefono, es_admin, activo, creado_en FROM usuarios WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        return jsonify(user)
    except Error as e:
        print(f"Error getting profile: {e}")
        return jsonify({'error': 'Error getting profile'}), 500

@app.route('/api/usuario/perfil', methods=['PUT'])
@require_auth
def update_profile():
    try:
        user_id = request.current_user['id']
        data = request.get_json()
        
        email = data.get('email')
        telefono = data.get('telefono')
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Si quiere cambiar contraseña, verificar la actual
        if new_password:
            cursor.execute('SELECT password FROM usuarios WHERE id = %s', (user_id,))
            user = cursor.fetchone()
            
            if not verify_password(current_password, user['password']):
                conn.close()
                return jsonify({'error': 'Current password is incorrect'}), 400
        
        updates = []
        values = []
        
        if email is not None:
            updates.append('email = %s')
            values.append(email)
        if telefono is not None:
            updates.append('telefono = %s')
            values.append(telefono)
        if new_password:
            updates.append('password = %s')
            values.append(hash_password(new_password))
        
        if not updates:
            return jsonify({'error': 'No fields to update'}), 400
        
        values.append(user_id)
        
        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        # Fetch the updated user
        cursor.execute('SELECT id, username, email, telefono, es_admin, activo, creado_en FROM usuarios WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        return jsonify(user)
    except Error as e:
        print(f"Error updating profile: {e}")
        return jsonify({'error': 'Error updating profile'}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=3001)