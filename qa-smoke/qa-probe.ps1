$root = 'C:\Users\DT User\Desktop\Portfolio\site'
Write-Output ("TESTPATH_SITE=" + (Test-Path -LiteralPath $root))
Write-Output ("TESTPATH_SRC=" + (Test-Path -LiteralPath (Join-Path $root 'src')))
Write-Output ("TESTPATH_COMP=" + (Test-Path -LiteralPath (Join-Path $root 'src\components')))
Write-Output '----SRC----'
if (Test-Path -LiteralPath (Join-Path $root 'src')) {
  Get-ChildItem -LiteralPath (Join-Path $root 'src') | ForEach-Object { $_.Name }
}
Write-Output '----COMPONENTS----'
$comp = Join-Path $root 'src\components'
if (Test-Path -LiteralPath $comp) {
  Get-ChildItem -LiteralPath $comp -Recurse -File | ForEach-Object { $_.FullName.Substring($root.Length) }
}
Write-Output '----HTTP----'
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 15
  Write-Output ("HTTP=" + $r.StatusCode)
  $r.Content | Set-Content -LiteralPath 'C:\Users\DT User\Desktop\Portfolio\site\qa-smoke\home.html' -Encoding UTF8
  Write-Output 'WROTE home.html'
} catch {
  Write-Output ("HTTP_ERR=" + $_.Exception.Message)
}
