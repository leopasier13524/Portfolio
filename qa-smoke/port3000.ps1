$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
  Write-Output ("PID=" + $c.OwningProcess + " NAME=" + $p.ProcessName + " START=" + $p.StartTime)
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  if ($_.CommandLine -match 'start-server|next') {
    Write-Output ("NODE PID=" + $_.ProcessId + " START=" + $_.CreationDate)
    Write-Output ("CMD=" + $_.CommandLine)
  }
}
