# QuantSight Project Reorganization Script
# This script moves files to frontend/ and backend/ structure

Write-Host "Starting QuantSight reorganization..." -ForegroundColor Cyan

$projectRoot = "c:\Users\arnav\OneDrive\Desktop\Projects\StocksNow"
Set-Location $projectRoot

# ============================================
# FRONTEND FILES TO MOVE
# ============================================
Write-Host "`nMoving frontend files..." -ForegroundColor Yellow

# React source files
$frontendDirs = @(
    "components",
    "contexts",
    "hooks",
    "services",
    "styles",
    "utils"
)

foreach ($dir in $frontendDirs) {
    if (Test-Path $dir) {
        Write-Host "Moving $dir/ to frontend/" -ForegroundColor Green
        Move-Item -Path $dir -Destination "frontend\" -Force
    }
}

# Frontend root files
$frontendFiles = @(
    "App.tsx",
    "main.tsx",
    "index.html",
    "vite.config.ts",
    "vite-env.d.ts",
    "postcss.config.js",
    "tailwind.config.js",
    "tsconfig.json",
    "tsconfig.node.json",
    "package.json",
    "package-lock.json"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        Write-Host "Moving $file to frontend/" -ForegroundColor Green
        Move-Item -Path $file -Destination "frontend\" -Force
    }
}

# Create frontend .env
if (Test-Path ".env") {
    Write-Host "Copying .env to frontend/" -ForegroundColor Green
    Copy-Item -Path ".env" -Destination "frontend\.env" -Force
}

# ============================================
# BACKEND FILES TO MOVE
# ============================================
Write-Host "`nMoving backend files..." -ForegroundColor Yellow

# Python source files
$backendDirs = @(
    "core",
    "templates",
    "static",
    "data",
    "models"
)

foreach ($dir in $backendDirs) {
    if (Test-Path $dir) {
        Write-Host "Moving $dir/ to backend/" -ForegroundColor Green
        Move-Item -Path $dir -Destination "backend\" -Force
    }
}

# Backend root files
$backendFiles = @(
    "main.py",
    "requirements.txt"
)

foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Write-Host "Moving $file to backend/" -ForegroundColor Green
        Move-Item -Path $file -Destination "backend\" -Force
    }
}

# Create backend .env
if (Test-Path ".env") {
    Write-Host "Copying .env to backend/" -ForegroundColor Green
    Copy-Item -Path ".env" -Destination "backend\.env" -Force
}

# ============================================
# KEEP IN ROOT
# ============================================
Write-Host "`nRoot files (keeping in place):" -ForegroundColor Yellow
$rootFiles = @(
    ".gitignore",
    ".env",
    ".env.example",
    "README.md",
    "SUPABASE_SETUP.md",
    "QUICKSTART.md",
    "LICENSE",
    "CNAME"
)

foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor DarkGray
    }
}

Write-Host "`nReorganization complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. cd frontend && npm install" -ForegroundColor White
Write-Host "2. cd backend && pip install -r requirements.txt" -ForegroundColor White
Write-Host "3. Update configs and test locally" -ForegroundColor White
