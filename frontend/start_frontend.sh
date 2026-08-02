#!/bin/bash
cd "$(dirname "$0")"
python3 -c "
import http.server
import socketserver

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler

class CORSHandler(Handler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

with socketserver.TCPServer(('0.0.0.0', PORT), CORSHandler) as httpd:
    print(f'Servidor frontend corriendo en http://0.0.0.0:{PORT}')
    print(f'Acceso desde tu red: http://192.168.1.98:{PORT}')
    print('Presiona Ctrl+C para detener')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\\nServidor detenido')
        httpd.server_close()
"