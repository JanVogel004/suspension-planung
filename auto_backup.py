import urllib.request
import json
import datetime
import os

SUPABASE_URL = 'https://dxxizztzvwnlwruxwmrw.supabase.co/rest/v1'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eGl6enR6dndubHdydXh3bXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODY1NjcsImV4cCI6MjEwNTc2MjU2N30.0-zKgzFWCqCXyhb7uCv1IGQtvzuWRoRrJ7ja6QbDCsQ'

backup_dir = r'C:\Users\vogel\OneDrive - mci4me.at\Dokumente\111_CTM\Suspension\WebApp_Planung\backups\auto'
os.makedirs(backup_dir, exist_ok=True)

for table in ['bauteile', 'lieferanten', 'normteile']:
    req = urllib.request.Request(
        f"{SUPABASE_URL}/{table}?select=*",
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = response.read().decode('utf-8')
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            file_path = os.path.join(backup_dir, f"{table}_backup_{timestamp}.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(data)
            print(f"Backed up {table} to {file_path}")
    except Exception as e:
        print(f"Failed to backup {table}: {e}")

# Clean up old backups (keep last 30 days)
now = datetime.datetime.now()
for filename in os.listdir(backup_dir):
    file_path = os.path.join(backup_dir, filename)
    if os.path.isfile(file_path):
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
        if (now - mtime).days > 30:
            os.remove(file_path)
