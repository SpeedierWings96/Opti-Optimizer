# Opti Optimizer GitHub Installer
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Configuration
$repoOwner = "SpeedierWings96"  # Replace with your GitHub username
$repoName = "opti-optimizer"
$installPath = "$env:LOCALAPPDATA\OptiOptimizer"
$shortcutPath = "$env:USERPROFILE\Desktop\OptiOptimizer.lnk"

Write-Host "⚡ Opti Optimizer Installer" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Function to check and install Node.js
function Install-NodeJS {
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "📦 Installing Node.js..." -ForegroundColor Yellow
        $nodeUrl = "https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi"
        $nodeInstaller = "$env:TEMP\node_installer.msi"
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait
        Remove-Item $nodeInstaller -Force
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
}

# Function to download repository
function Get-Repository {
    Write-Host "📥 Downloading latest version..." -ForegroundColor Yellow
    
    # Create temp directory
    $tempDir = "$env:TEMP\OptiOptimizer_temp"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    
    # Download repository as zip
    $zipUrl = "https://github.com/$repoOwner/$repoName/archive/main.zip"
    $zipFile = "$tempDir\repo.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
    
    # Extract zip
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
    
    # Move files to install location
    New-Item -ItemType Directory -Force -Path $installPath | Out-Null
    Copy-Item -Path "$tempDir\$repoName-main\*" -Destination $installPath -Recurse -Force
    
    # Cleanup
    Remove-Item -Path $tempDir -Recurse -Force
}

# Function to create shortcut
function New-Shortcut {
    Write-Host "🔗 Creating desktop shortcut..." -ForegroundColor Yellow
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$installPath\launcher.ps1`""
    $Shortcut.WorkingDirectory = $installPath
    $Shortcut.IconLocation = "$installPath\build\icon.ico"
    $Shortcut.Save()
}

# Main installation process
try {
    # Check and install Node.js
    Install-NodeJS
    
    # Download and install the application
    Get-Repository
    
    # Install dependencies
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    Set-Location $installPath
    npm install --production
    
    # Create shortcut
    New-Shortcut
    
    # Create registry entries for global command
    Write-Host "⚙️ Setting up system integration..." -ForegroundColor Yellow
    $registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\optiopti.exe"
    New-Item -Path $registryPath -Force | Out-Null
    Set-ItemProperty -Path $registryPath -Name "(Default)" -Value "$installPath\launcher.ps1"
    
    # Add to PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$installPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
    }
    
    Write-Host "`n✅ Installation completed successfully!" -ForegroundColor Green
    Write-Host "You can now run Opti Optimizer in three ways:" -ForegroundColor Cyan
    Write-Host "1. Double-click the desktop shortcut" -ForegroundColor White
    Write-Host "2. Run 'optiopti' from any terminal" -ForegroundColor White
    Write-Host "3. Press Win+R and type 'optiopti'" -ForegroundColor White
    
    # Ask to run
    $runNow = Read-Host "`nWould you like to run Opti Optimizer now? (y/n)"
    if ($runNow -eq 'y') {
        Write-Host "🚀 Launching Opti Optimizer..." -ForegroundColor Green
        Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$installPath\launcher.ps1`""
    }
    
} catch {
    Write-Host "`n❌ Error during installation:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} 