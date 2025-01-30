# Opti Optimizer Installation Script
$installPath = "$env:LOCALAPPDATA\OptiOptimizer"
$shortcutPath = "$env:USERPROFILE\Desktop\OptiOptimizer.lnk"
$registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\optiopti.exe"

# Create installation directory
New-Item -ItemType Directory -Force -Path $installPath | Out-Null

# Copy files to installation directory
Copy-Item -Path ".\*" -Destination $installPath -Recurse -Force

# Create desktop shortcut
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "$installPath\OptiOptimizer.exe"
$Shortcut.Save()

# Add to PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
}

# Create registry entry for global command
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(Default)" -Value "$installPath\OptiOptimizer.exe"

Write-Host "Opti Optimizer installed successfully!" -ForegroundColor Green
Write-Host "You can now run it by typing 'optiopti' in PowerShell or Command Prompt" -ForegroundColor Cyan 