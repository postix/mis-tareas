#!/usr/bin/env python3
import http.server

class HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

if __name__ == '__main__':
    server_address = ('0.0.0.0', 8000)
    httpd = http.server.HTTPServer(server_address, HTTPRequestHandler)
    print(f"Server running on http://0.0.0.0:8000")
    print(f"Access from your network: http://192.168.1.98:8000")
    httpd.serve_forever()