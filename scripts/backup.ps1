param(
  [Parameter(Mandatory = $true)][string]$DatabaseName,
  [Parameter(Mandatory = $true)][string]$UploadDir,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [Parameter(Mandatory = $true)][string]$MysqlHost,
  [Parameter(Mandatory = $true)][string]$MysqlUser,
  [int]$MysqlPort = 3306
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $UploadDir -PathType Container)) { throw 'UploadDir must be an existing directory.' }
if (-not (Test-Path -LiteralPath $OutputDir -PathType Container)) { throw 'OutputDir must be an existing, access-controlled backup directory.' }
if ([string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) { throw 'Set DB_PASSWORD in the current shell before creating the backup.' }
$mysqldump = Get-Command mysqldump -ErrorAction Stop
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$dumpPath = Join-Path (Resolve-Path -LiteralPath $OutputDir).Path "flow-erp-db-$stamp.sql"
$uploadsPath = Join-Path (Resolve-Path -LiteralPath $OutputDir).Path "flow-erp-uploads-$stamp.tar.gz"
$manifestPath = Join-Path (Resolve-Path -LiteralPath $OutputDir).Path "flow-erp-backup-$stamp.json"
$artifacts = @($dumpPath, $uploadsPath, $manifestPath)
if (@($artifacts | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0) { throw 'A backup artifact already exists for this timestamp.' }
$previousMysqlPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $env:DB_PASSWORD
$arguments = @('--host', $MysqlHost, '--port', "$MysqlPort", '--user', $MysqlUser, '--single-transaction', '--routines', '--triggers', '--events', '--result-file', $dumpPath, $DatabaseName)
try {
  & $mysqldump.Source @arguments
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dumpPath) -or (Get-Item -LiteralPath $dumpPath).Length -eq 0) { throw 'Database dump failed or produced an empty file.' }
  & tar -czf $uploadsPath -C (Resolve-Path -LiteralPath $UploadDir).Path .
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $uploadsPath) -or (Get-Item -LiteralPath $uploadsPath).Length -eq 0) { throw 'Upload archive failed or produced an empty file.' }
  $manifest = [ordered]@{
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    database = $DatabaseName
    databaseDump = [ordered]@{ file = [IO.Path]::GetFileName($dumpPath); bytes = (Get-Item -LiteralPath $dumpPath).Length; sha256 = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash }
    uploadsArchive = [ordered]@{ file = [IO.Path]::GetFileName($uploadsPath); bytes = (Get-Item -LiteralPath $uploadsPath).Length; sha256 = (Get-FileHash -LiteralPath $uploadsPath -Algorithm SHA256).Hash }
  }
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8
  Write-Output "Backup set created: $dumpPath; $uploadsPath; $manifestPath"
} finally {
  if ($null -eq $previousMysqlPassword) { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue }
  else { $env:MYSQL_PWD = $previousMysqlPassword }
}
