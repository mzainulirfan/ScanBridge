param(
  [Parameter(Mandatory = $true)] [string]$PrimaryExe,
  [Parameter(Mandatory = $true)] [string[]]$SecondaryExe
)

$ErrorActionPreference = "Stop"

function Get-ScannerProcesses {
  @(Get-CimInstance Win32_Process -Filter "Name = 'scanbridge-desktop.exe'")
}

function Resolve-ScannerBinary([string]$Path) {
  $file = Get-Item -LiteralPath $Path
  if ($file.Name -ne 'scanbridge-desktop.exe' -or [version]$file.VersionInfo.ProductVersion -lt [version]'0.1.6') {
    throw "Use a ScanBridge 0.1.6 or newer binary: $Path"
  }
  $file.FullName
}

$primaryPath = Resolve-ScannerBinary $PrimaryExe
$secondaryPaths = @($SecondaryExe | ForEach-Object { Resolve-ScannerBinary $_ })
$running = @(Get-ScannerProcesses)
if ($running.Count -ne 1 -or $running[0].ExecutablePath -ne $primaryPath) {
  throw "Start exactly one copy of the nominated primary binary before running this check."
}
$primaryProcessId = $running[0].ProcessId

foreach ($path in $secondaryPaths) {
  $secondary = Start-Process -FilePath $path -WindowStyle Hidden -PassThru
  try {
    if (-not $secondary.WaitForExit(15000)) {
      throw "Secondary instance did not exit: $path"
    }
    if ($secondary.ExitCode -ne 0) {
      throw "Secondary instance returned exit $($secondary.ExitCode): $path"
    }
    $after = @(Get-ScannerProcesses)
    if ($after.Count -ne 1 -or $after[0].ProcessId -ne $primaryProcessId) {
      throw "Expected the original single process to remain running."
    }
    Write-Output "PASS: secondary launch exited; primary process $primaryProcessId remains the only helper ($path)."
  } finally {
    if (-not $secondary.HasExited) {
      Stop-Process -Id $secondary.Id -ErrorAction SilentlyContinue
    }
    $secondary.Dispose()
  }
}
