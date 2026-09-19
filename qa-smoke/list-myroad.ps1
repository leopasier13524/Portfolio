Get-ChildItem -LiteralPath 'C:\Users\DT User\Desktop\Portfolio\site\src\components' -Recurse -File -Name
Write-Output '----'
Get-ChildItem -LiteralPath 'C:\Users\DT User\Desktop\Portfolio\site\src' -Recurse -Include *.tsx,*.ts -File |
  Select-String -Pattern 'My Road|MyRoad|paperPlane|paper-plane|data-road|JourneyView|RoadJourney|locked.?stop' |
  Select-Object -First 60 | ForEach-Object { "$($_.Filename):$($_.LineNumber):$($_.Line.Trim())" }
