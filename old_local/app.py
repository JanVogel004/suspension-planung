import http.server
import socketserver
import json
import csv
import os
import traceback

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/':
            self.send_response(302)
            self.send_header('Location', '/index.html?v=1790190734')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.end_headers()
            return
        if self.path == '/api/bauteile':
            self.send_csv_as_json('bauteile.csv')
        elif self.path == '/api/lieferanten':
            self.send_csv_as_json('lieferanten.csv')
        elif self.path == '/api/normteile':
            self.send_csv_as_json('normteile.csv')
        else:
            return super().do_GET()

    def do_POST(self):
        # Basic Security Check
        if self.headers.get('X-Password') != 'suspension':
            self.send_error(403, "Forbidden: Invalid Password")
            return

        if self.path == '/api/save_bauteile':
            self.save_json_to_csv('bauteile.csv')
        elif self.path == '/api/save_lieferanten':
            self.save_json_to_csv('lieferanten.csv')
        elif self.path == '/api/save_normteile':
            self.save_json_to_csv('normteile.csv')
        else:
            self.send_error(404)

    def send_csv_as_json(self, filename):
        filepath = os.path.join(DIRECTORY, filename)
        data = []
        columns = []
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                columns = list(reader.fieldnames or [])
                data = list(reader)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"data": data, "columns": columns}).encode('utf-8'))

    def save_json_to_csv(self, filename):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            
            data = payload.get('data', [])
            columns = payload.get('columns', [])
            
            filepath = os.path.join(DIRECTORY, filename)
            
            # --- BACKUP MECHANISM ---
            if os.path.exists(filepath):
                import datetime
                import shutil
                import glob
                backup_dir = os.path.join(DIRECTORY, 'backups')
                os.makedirs(backup_dir, exist_ok=True)
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
                base = filename.replace('.csv', '')
                backup_path = os.path.join(backup_dir, f"{base}_{timestamp}.csv")
                shutil.copy2(filepath, backup_path)
                
                # Cleanup: Keep only last 20 backups per file
                existing_backups = sorted(glob.glob(os.path.join(backup_dir, f"{base}_*.csv")))
                if len(existing_backups) > 20:
                    for old_backup in existing_backups[:-20]:
                        try:
                            os.remove(old_backup)
                        except:
                            pass
            # ------------------------

            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=columns)
                writer.writeheader()
                writer.writerows(data)
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
        except Exception as e:
            print("Error saving:", traceback.format_exc())
            self.send_error(500, str(e))

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), MyHttpRequestHandler) as httpd:
        print(f"Server gestartet auf http://localhost:{PORT}")
        httpd.serve_forever()
