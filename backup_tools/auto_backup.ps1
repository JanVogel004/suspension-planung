$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path -Path $ProjectDir -ChildPath "backups\auto"

$SupabaseUrl = "https://dxxizztzvwnlwruxwmrw.supabase.co/rest/v1"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eGl6enR6dndubHdydXh3bXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODY1NjcsImV4cCI6MjEwNTc2MjU2N30.0-zKgzFWCqCXyhb7uCv1IGQtvzuWRoRrJ7ja6QbDCsQ"

if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$Headers = @{
    "apikey" = $SupabaseKey
    "Authorization" = "Bearer $SupabaseKey"
}

$Tables = @("bauteile", "lieferanten", "normteile")
$Timestamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")

foreach ($Table in $Tables) {
    try {
        $Response = Invoke-RestMethod -Uri "$SupabaseUrl/$Table?select=*" -Method Get -Headers $Headers
        $FilePath = Join-Path -Path $BackupDir -ChildPath "${Table}_backup_${Timestamp}.json"
        $Response | ConvertTo-Json -Depth 10 | Set-Content -Path $FilePath -Encoding UTF8
        Write-Host "Backed up $Table to $FilePath"
    } catch {
        Write-Host "Error backing up $Table"
    }
}

# Cleanup older than 30 days
Get-ChildItem -Path $BackupDir -Filter "*.json" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
