$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\Users\DT User\Desktop\Portfolio\site\qa-smoke'
Write-Output 'install chromium if needed'
npx --yes playwright install chromium
Write-Output 'run smoke'
npx --yes -p playwright node projects-smoke.mjs
Write-Output ("exit=" + $LASTEXITCODE)
