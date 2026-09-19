Get-ChildItem -LiteralPath 'C:\Users\DT User\Desktop\Portfolio\site\src' -Recurse -Include *.tsx,*.ts,*.css -File |
  Select-String -Pattern 'My Road|MyRoad|paper-plane|paperPlane|journey|RoadPath|MyJourney' |
  Select-Object -First 50 | ForEach-Object { "$($_.Filename):$($_.LineNumber):$($_.Line.Trim())" }
