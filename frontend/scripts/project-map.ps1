param(
    [string]$ProjectRoot = "C:\Users\MEHMET YILDIRIM\risknova-platform\frontend"
)

Set-Location $ProjectRoot

$appRoot = Join-Path $ProjectRoot "src\app"
if (!(Test-Path $appRoot)) {
    $appRoot = Join-Path $ProjectRoot "app"
}

if (!(Test-Path $appRoot)) {
    Write-Host "app klasoru bulunamadi: $appRoot"
    exit 1
}

function Normalize-RouteFromFilePath {
    param(
        [string]$FullPath,
        [string]$AppRoot
    )

    $relative = $FullPath.Substring($AppRoot.Length).TrimStart('\')
    $relative = $relative -replace '\\', '/'

    $relative = $relative -replace '/page\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/layout\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/template\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/loading\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/error\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/not-found\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/default\.(tsx|ts|jsx|js)$', ''
    $relative = $relative -replace '/route\.(tsx|ts|jsx|js)$', ''

    if ($relative -eq "") {
        return "/"
    }

    $segments = $relative.Split('/') | Where-Object { $_ -ne "" } | ForEach-Object {
        if ($_ -match '^\(.*\)$') {
            return $null
        }

        if ($_ -match '^@') {
            return $null
        }

        return $_
    } | Where-Object { $_ -ne $null }

    $route = "/" + ($segments -join "/")
    if ($route -eq "") {
        $route = "/"
    }

    return $route
}

function Get-EntryType {
    param([string]$Name)

    switch -Regex ($Name) {
        '^page\.(tsx|ts|jsx|js)$'       { return 'PAGE' }
        '^layout\.(tsx|ts|jsx|js)$'     { return 'LAYOUT' }
        '^route\.(tsx|ts|jsx|js)$'      { return 'API_ROUTE' }
        '^loading\.(tsx|ts|jsx|js)$'    { return 'LOADING' }
        '^error\.(tsx|ts|jsx|js)$'      { return 'ERROR' }
        '^template\.(tsx|ts|jsx|js)$'   { return 'TEMPLATE' }
        '^not-found\.(tsx|ts|jsx|js)$'  { return 'NOT_FOUND' }
        '^default\.(tsx|ts|jsx|js)$'    { return 'DEFAULT' }
        default                         { return 'OTHER' }
    }
}

$reportLines = New-Object System.Collections.Generic.List[string]

$reportLines.Add("PROJECT ROOT: $ProjectRoot")
$reportLines.Add("APP ROOT: $appRoot")
$reportLines.Add("")

$reportLines.Add("==== FOLDERS ====")

$folders = Get-ChildItem -LiteralPath $appRoot -Directory -Recurse | Sort-Object FullName
foreach ($folder in $folders) {
    $relativeFolder = $folder.FullName.Substring($appRoot.Length).TrimStart('\')
    $route = Normalize-RouteFromFilePath -FullPath ($folder.FullName + "\page.tsx") -AppRoot $appRoot
    $reportLines.Add("FOLDER  | $relativeFolder | ROUTE_HINT: $route")
}

$reportLines.Add("")
$reportLines.Add("==== ROUTE FILES ====")

$routeFiles = Get-ChildItem -LiteralPath $appRoot -File -Recurse | Where-Object {
    $_.Name -match '^(page|layout|route|loading|error|template|not-found|default)\.(tsx|ts|jsx|js)$'
} | Sort-Object FullName

$entries = @()

foreach ($file in $routeFiles) {
    $type = Get-EntryType -Name $file.Name
    $relativeFile = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\')
    $route = Normalize-RouteFromFilePath -FullPath $file.FullName -AppRoot $appRoot

    $obj = [PSCustomObject]@{
        Type        = $type
        Route       = $route
        File        = $relativeFile
        FileName    = $file.Name
        Folder      = Split-Path $relativeFile -Parent
    }

    $entries += $obj
    $reportLines.Add(("{0,-10} | {1,-30} | {2}" -f $type, $route, $relativeFile))
}

$reportLines.Add("")
$reportLines.Add("==== ONLY PAGES ====")

$entries |
    Where-Object { $_.Type -eq "PAGE" } |
    Sort-Object Route |
    ForEach-Object {
        $reportLines.Add(("{0,-30} | {1}" -f $_.Route, $_.File))
    }

$reportLines.Add("")
$reportLines.Add("==== ONLY API ROUTES ====")

$entries |
    Where-Object { $_.Type -eq "API_ROUTE" } |
    Sort-Object Route |
    ForEach-Object {
        $reportLines.Add(("{0,-30} | {1}" -f $_.Route, $_.File))
    }

$reportPath = Join-Path $ProjectRoot "project-structure-report.txt"
$jsonPath   = Join-Path $ProjectRoot "project-structure-report.json"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($reportPath, $reportLines, $utf8NoBom)

$entries |
    ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $jsonPath -Encoding UTF8

Write-Host ""
Write-Host "Rapor olusturuldu:"
Write-Host $reportPath
Write-Host $jsonPath
Write-Host ""
Write-Host "Sayfalar:"
$entries | Where-Object { $_.Type -eq "PAGE" } | Sort-Object Route | Format-Table Route, File -AutoSize
Write-Host ""
Write-Host "API route dosyalari:"
$entries | Where-Object { $_.Type -eq "API_ROUTE" } | Sort-Object Route | Format-Table Route, File -AutoSize