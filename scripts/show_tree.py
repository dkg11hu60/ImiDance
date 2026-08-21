# 1. Szkriptek mozgatása
$scripts = @("build_data.py", "update_from_excel.py")
foreach ($s in $scripts) {
    if (Test-Path $s) {
        Write-Host "Moving $s to scripts/..."
        Move-Item -Path $s -Destination "scripts/" -Force
    }
}

# 2. Adatok mappájának létrehozása és fájl mozgatása
if (!(Test-Path "data")) {
    New-Item -ItemType Directory -Path "data"
}
if (Test-Path "jelentkezesek.xlsx") {
    Write-Host "Moving jelentkezesek.xlsx to data/..."
    Move-Item -Path "jelentkezesek.xlsx" -Destination "data/" -Force
}

# 3. README átnevezése (javított zárójelezéssel és kisbetűs operátorral)
if ((Test-Path "README") -and (-not (Test-Path "README.md"))) {
    Rename-Item -Path "README" -NewName "README.md"
    Write-Host "Renamed README to README.md"
}

# 4. .gitignore frissítése
$gitIgnore = ".gitignore"
$excludeLine = ".history/"
if (Test-Path $gitIgnore) {
    $content = Get-Content $gitIgnore
    if ($content -notcontains $excludeLine) {
        Add-Content -Path $gitIgnore -Value $excludeLine
        Write-Host "Added .history/ to .gitignore"
    }
} else {
    Set-Content -Path $gitIgnore -Value $excludeLine
    Write-Host "Created .gitignore with .history/"
}

Write-Host "Cleanup completed successfully!"