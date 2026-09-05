if (Get-Command winget -ErrorAction SilentlyContinue) { Write-Output "winget already installed"; exit 0 }
Install-PackageProvider -Name NuGet -Force | Out-Null
Install-Module -Name Microsoft.WinGet.Client -Force -Repository PSGallery | Out-Null
Repair-WinGetPackageManager -AllUsers
exit $LASTEXITCODE
