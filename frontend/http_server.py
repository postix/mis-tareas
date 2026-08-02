#!/usr/bin/env python3
import http.server
import socketserver

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    PORT = 8000
    Handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Servidor corriendo en http://0.0.0.0:{PORT}")
        print(f"Acceso desde tu red: http://192.168.1.98:{PORT}")
        print("Presiona Ctrl+C para detener")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido")
        finally:
            httpd.server_close()