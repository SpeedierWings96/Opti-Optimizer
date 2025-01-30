# Opti Optimizer Launcher
$installPath = "$env:LOCALAPPDATA\OptiOptimizer"

if (Test-Path "$installPath\OptiOptimizer.exe") {
    Start-Process "$installPath\OptiOptimizer.exe"
} else {
    Write-Host "Opti Optimizer is not installed. Please run the installer first." -ForegroundColor Red
} 