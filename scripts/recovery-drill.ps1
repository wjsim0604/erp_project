param(
  [Parameter(Mandatory = $true)][string]$DatabaseDump,
  [Parameter(Mandatory = $true)][string]$UploadsArchive,
  [Parameter(Mandatory = $true)][string]$RestoreRoot,
  [Parameter(Mandatory = $true)][string]$MysqlHost,
  [Parameter(Mandatory = $true)][string]$MysqlUser,
  [int]$MysqlPort = 3306,
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$dump = (Resolve-Path -LiteralPath $DatabaseDump).Path
$archive = (Resolve-Path -LiteralPath $UploadsArchive).Path
$mysql = Get-Command mysql -ErrorAction Stop
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$database = "flow_erp_drill_$stamp"
if (-not (Test-Path -LiteralPath $RestoreRoot -PathType Container)) { throw 'RestoreRoot must be an existing, dedicated recovery directory.' }
$uploadTarget = Join-Path (Resolve-Path -LiteralPath $RestoreRoot).Path "uploads_$stamp"
$archiveList = & tar -tzf $archive
if ($LASTEXITCODE -ne 0) { throw 'Upload archive cannot be read as a tar.gz file.' }
Write-Output "Planned isolated recovery database: $database"
Write-Output "Planned isolated upload directory: $uploadTarget"
Write-Output "Archive entries found: $($archiveList.Count)"
if (-not $Execute) {
  Write-Output 'Dry run only. Add -Execute to create the isolated database, restore the dump, and extract files.'
  exit 0
}
if (Test-Path -LiteralPath $uploadTarget) { throw "Restore target already exists: $uploadTarget" }
if ([string]::IsNullOrWhiteSpace($env:RECOVERY_DB_PASSWORD)) { throw 'Set RECOVERY_DB_PASSWORD in the current shell before executing the recovery drill.' }
$previousMysqlPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $env:RECOVERY_DB_PASSWORD
$mysqlArgs = @('--host', $MysqlHost, '--port', "$MysqlPort", '--user', $MysqlUser, '--default-character-set=utf8mb4', '--batch', '--skip-column-names')
try {
  & $mysql.Source @mysqlArgs '--execute' "CREATE DATABASE ``$database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated recovery database.' }
  & $mysql.Source @mysqlArgs '--database' $database '--execute' "source $($dump.Replace('\','/'))"
  if ($LASTEXITCODE -ne 0) { throw "Database restore failed. Isolated database retained for inspection: $database" }
  New-Item -ItemType Directory -Path $uploadTarget | Out-Null
  & tar -xzf $archive -C $uploadTarget
  if ($LASTEXITCODE -ne 0) { throw "Upload extraction failed. Files extracted so far remain at: $uploadTarget" }
  $tables = & $mysql.Source @mysqlArgs '--database' $database '--execute' 'SHOW TABLES'
  if ($LASTEXITCODE -ne 0 -or $tables -notcontains 'users' -or $tables -notcontains 'projects' -or $tables -notcontains 'project_documents' -or $tables -notcontains 'typeorm_migrations') { throw "Restored DB is missing required tables. Inspect isolated DB: $database" }
  $documentCount = & $mysql.Source @mysqlArgs '--database' $database '--execute' 'SELECT COUNT(*) FROM project_documents'
  $fileCount = (Get-ChildItem -LiteralPath $uploadTarget -File -Recurse).Count
  Write-Output "Recovery drill passed schema checks. DB=$database; document records=$documentCount; restored files=$fileCount; uploads=$uploadTarget"
  Write-Output 'Keep this isolated restore for application-level login, document download, and report checks; remove it only after review.'
} finally {
  if ($null -eq $previousMysqlPassword) { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue }
  else { $env:MYSQL_PWD = $previousMysqlPassword }
}
