param(
    [string]$AabPath,
    [string]$Tag
)

$ErrorActionPreference = "Stop"

$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) {
    $gh = "C:\Program Files\GitHub CLI\gh.exe"
}
if (-not (Test-Path $gh)) {
    Write-Error "GitHub CLI (gh) not found. Install it (winget install GitHub.cli) and run 'gh auth login' first."
    exit 1
}

if (-not $AabPath) {
    $AabPath = Get-ChildItem "$env:USERPROFILE\Downloads\*.aab" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $AabPath -or -not (Test-Path $AabPath)) {
    Write-Error "No .aab file found in Downloads. Pass one explicitly: upload-aab.ps1 -AabPath 'C:\path\to\file.aab'"
    exit 1
}

$appJson = Get-Content (Join-Path $PSScriptRoot "..\app.json") -Raw | ConvertFrom-Json
$version = $appJson.expo.version

if (-not $Tag) {
    $Tag = "v$version"
    & $gh release view $Tag *> $null
    if ($LASTEXITCODE -eq 0) {
        $Tag = "$Tag-$(Get-Date -Format yyyyMMddHHmmss)"
    }
}

$assetName = "Kalinga-$Tag.aab"
Write-Host "Publishing $AabPath as release '$Tag' (asset: $assetName)..."
& $gh release create $Tag "$AabPath#$assetName" --title $Tag --notes "Android App Bundle build $Tag."

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done."
} else {
    Write-Error "gh release create failed (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}
