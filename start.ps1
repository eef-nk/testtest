$ErrorActionPreference = 'SilentlyContinue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

$port = 8888
$url  = "http://localhost:$port/index.html"

$host.UI.RawUI.WindowTitle = "PBS Editor Server"
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  PBS Editor - Local Server" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Kill any process already listening on port 8888
$occupied = netstat -ano 2>$null |
    Select-String (":$port\s") |
    ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] } |
    Select-Object -Unique |
    Where-Object { $_ -match '^\d+$' }

foreach ($procId in $occupied) {
    try {
        Stop-Process -Id ([int]$procId) -Force
        Write-Host "[Cleanup] Killed existing server (PID $procId)" -ForegroundColor Yellow
    } catch {}
}

# Find Python 3
$pyexe = $null
$candidates = @(where.exe python 2>$null) + @(where.exe python3 2>$null)

foreach ($p in $candidates) {
    if (-not $pyexe -and (Test-Path $p)) {
        try {
            $ver = & $p -c "import sys; print(sys.version_info[0])" 2>$null
            if ([int]$ver -ge 3) { $pyexe = $p }
        } catch {}
    }
}

# Fall back to Node.js if Python not found
if (-not $pyexe) {
    $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
    if ($npxCmd) {
        Write-Host "[OK] Node.js found" -ForegroundColor Green
        Write-Host "[Server] $url  (close this window to stop)" -ForegroundColor Green
        Write-Host ""
        $chromeCmd = Get-Command chrome -ErrorAction SilentlyContinue
        if ($chromeCmd) { Start-Process $chromeCmd.Source $url }
        & $npxCmd.Source serve -l $port .
        exit
    }
    Write-Host "[ERROR] Python 3 or Node.js is required." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install Python : https://www.python.org/downloads/"
    Write-Host "  (Check 'Add Python to PATH' during installation)"
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

Write-Host "[OK] $pyexe" -ForegroundColor Green
Write-Host "[Server] $url" -ForegroundColor Green
Write-Host ""

# Find Chrome
$chromePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

# Open browser after a short delay (background job)
$openBrowser = {
    param($chrome, $url)
    Start-Sleep 2
    if ($chrome) { Start-Process $chrome $url }
    else         { Start-Process $url }
}
$null = Start-Job -ScriptBlock $openBrowser -ArgumentList $chrome, $url

# Run custom server (no-cache headers) in the foreground (this window = server log)
Write-Host "Press Ctrl+C or close this window to stop the server." -ForegroundColor DarkGray
Write-Host "-------------------------------------------------"
& $pyexe "$dir\server.py"
