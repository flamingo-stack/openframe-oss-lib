if (Get-Command choco -ErrorAction SilentlyContinue) { Write-Output "choco already installed"; exit 0 }
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
exit $LASTEXITCODE
