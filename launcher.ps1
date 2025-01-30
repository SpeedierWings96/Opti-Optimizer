# Opti Optimizer Direct Launcher
$Host.UI.RawUI.WindowTitle = "Opti Optimizer"

# Create process info
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "cmd.exe"
$processInfo.Arguments = "/c npm start"
$processInfo.WorkingDirectory = $PSScriptRoot
$processInfo.CreateNoWindow = $true
$processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true

# Start the process
$process = [System.Diagnostics.Process]::Start($processInfo)

# Optional: Hide the PowerShell window itself
Add-Type -Name Window -Namespace Console -MemberDefinition '
[DllImport("Kernel32.dll")]
public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
'
$consolePtr = [Console.Window]::GetConsoleWindow()
[Console.Window]::ShowWindow($consolePtr, 0) # 0 = hide

# Wait for the process to exit
$process.WaitForExit()
exit 