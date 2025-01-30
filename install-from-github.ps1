# Opti Optimizer Installation Script
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Configuration
$repoOwner = "SpeedierWings96"
$repoName = "Opti-Optimizer"
$installPath = "$env:LOCALAPPDATA\OptiOptimizer"
$shortcutPath = "$env:USERPROFILE\Desktop\OptiOptimizer.lnk"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-AdminPrivileges {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-AdminPrivileges {
    if (-not (Test-AdminPrivileges)) {
        Write-ColorOutput Yellow "⚠️ Requesting administrator privileges..."
        Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
        exit
    }
}

function Test-InternetConnection {
    $hasInternet = Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet
    if (-not $hasInternet) {
        Write-ColorOutput Red "❌ No internet connection detected. Please check your connection and try again."
        exit 1
    }
}

function Install-Prerequisites {
    Write-ColorOutput Cyan "📦 Checking prerequisites..."
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-ColorOutput Yellow "⚠️ Updating PowerShell..."
        try {
            $url = "https://github.com/PowerShell/PowerShell/releases/download/v7.3.4/PowerShell-7.3.4-win-x64.msi"
            $installer = "$env:TEMP\PowerShell-Install.msi"
            Invoke-WebRequest -Uri $url -OutFile $installer
            Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /quiet /norestart" -Wait
            Remove-Item $installer -Force
        } catch {
            Write-ColorOutput Red "❌ Failed to update PowerShell. Please update manually."
            exit 1
        }
    }

    # Check/Install Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Yellow "⚠️ Installing Node.js..."
        try {
            $nodeUrl = "https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi"
            $nodeInstaller = "$env:TEMP\node_installer.msi"
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait
            Remove-Item $nodeInstaller -Force
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            # Verify installation
            $nodeVersion = node --version
            if (-not $nodeVersion) {
                throw "Node.js installation verification failed"
            }
        } catch {
            Write-ColorOutput Red "❌ Failed to install Node.js. Error: $_"
            Write-ColorOutput Yellow "Please install Node.js manually from https://nodejs.org/"
            exit 1
        }
    }

    # Check/Install Git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Yellow "⚠️ Installing Git..."
        try {
            $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.42.0.windows.2/Git-2.42.0.2-64-bit.exe"
            $gitInstaller = "$env:TEMP\git_installer.exe"
            Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller
            Start-Process $gitInstaller -ArgumentList "/VERYSILENT /NORESTART" -Wait
            Remove-Item $gitInstaller -Force
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        } catch {
            Write-ColorOutput Red "❌ Failed to install Git. Error: $_"
            Write-ColorOutput Yellow "Please install Git manually from https://git-scm.com/"
            exit 1
        }
    }
}

function Install-OptiOptimizer {
    Write-ColorOutput Cyan "`n⚡ Installing Opti Optimizer..."
    
    try {
        # Create installation directory
        if (Test-Path $installPath) {
            Write-ColorOutput Yellow "📂 Removing existing installation..."
            Remove-Item -Path $installPath -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $installPath | Out-Null

        # Download repository
        Write-ColorOutput Cyan "📥 Downloading latest version..."
        $tempDir = "$env:TEMP\OptiOptimizer_temp"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        
        $zipUrl = "https://github.com/$repoOwner/$repoName/archive/main.zip"
        $zipFile = "$tempDir\repo.zip"
        
        try {
            Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -ErrorAction Stop
        } catch {
            Write-ColorOutput Red "❌ Failed to download repository. Error: $_"
            Write-ColorOutput Yellow "Please check your internet connection and try again."
            exit 1
        }

        # Extract and move files
        Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
        Copy-Item -Path "$tempDir\$repoName-main\*" -Destination $installPath -Recurse -Force

        # Install dependencies
        Write-ColorOutput Cyan "📦 Installing dependencies..."
        Push-Location $installPath
        npm install --production
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        Pop-Location

        # Create shortcut
        Write-ColorOutput Cyan "🔗 Creating desktop shortcut..."
        $WScriptShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installPath\launcher.ps1`""
        $Shortcut.WorkingDirectory = $installPath
        $Shortcut.IconLocation = "$installPath\build\icon.ico"
        $Shortcut.Save()

        # Add to PATH
        Write-ColorOutput Cyan "⚙️ Updating system PATH..."
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*$installPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
        }

        # Create registry entries
        Write-ColorOutput Cyan "⚙️ Creating registry entries..."
        $registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\optiopti.exe"
        New-Item -Path $registryPath -Force | Out-Null
        Set-ItemProperty -Path $registryPath -Name "(Default)" -Value "$installPath\launcher.ps1"

        # Cleanup
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

        Write-ColorOutput Green "`n✅ Installation completed successfully!"
        Write-ColorOutput Cyan "You can now run Opti Optimizer in three ways:"
        Write-ColorOutput White "1. Double-click the desktop shortcut"
        Write-ColorOutput White "2. Run 'optiopti' from any terminal"
        Write-ColorOutput White "3. Press Win+R and type 'optiopti'"

        $runNow = Read-Host "`nWould you like to run Opti Optimizer now? (y/n)"
        if ($runNow -eq 'y') {
            Write-ColorOutput Green "🚀 Launching Opti Optimizer..."
            Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installPath\launcher.ps1`""
        }

    } catch {
        Write-ColorOutput Red "`n❌ Installation failed!"
        Write-ColorOutput Red "Error: $_"
        Write-ColorOutput Yellow "Please try the following:"
        Write-ColorOutput White "1. Run the installer as administrator"
        Write-ColorOutput White "2. Check your internet connection"
        Write-ColorOutput White "3. Make sure Windows Defender or antivirus isn't blocking the installation"
        Write-ColorOutput White "4. Try installing Node.js manually from https://nodejs.org/"
        Write-ColorOutput White "5. Contact support if the issue persists"
        exit 1
    }
}

# Main installation process
Clear-Host
Write-ColorOutput Cyan @"
╔════════════════════════════════════════╗
║         Opti Optimizer Installer       ║
╚════════════════════════════════════════╝
"@

# Check prerequisites
Request-AdminPrivileges
Test-InternetConnection
Install-Prerequisites

# Install Opti Optimizer
Install-OptiOptimizer 