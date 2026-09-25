# Chocolatey package `openframe-client`

Source of the [`openframe-client`](https://community.chocolatey.org/packages/openframe-client) package on the Chocolatey community repository, published by the `Openframe` account. Users run `choco install openframe-client -y`, then `openframe-client auth ...` from the dashboard (**Devices → Add device**).

The package contains no binary. `tools/chocolateyInstall.ps1` downloads the Windows archive of one client release from `https://openframe.ai/v0/api/assets/download?agent=client&platform=windows&version=<x.y.z>`, verifies its SHA-256 and runs `openframe-client.exe install`. It does nothing when the `com.openframe.client` service already exists: updates are delivered by the OpenFrame platform, so `choco upgrade` never touches an installed agent. `tools/chocolateyUninstall.ps1` runs the installed `openframe-client.exe uninstall`.

## Testing on a clean Windows VM

```powershell
choco pack
choco install openframe-client -y -s . --debug --verbose
Get-Service com.openframe.client                     # Running, waiting for auth
# new elevated terminal
openframe-client auth --serverUrl <test tenant> --initialKey <key> --orgId <org id> --userId <user id>
openframe-client doctor
choco install openframe-client -y -s . --force       # skipped: the device stays connected
choco uninstall openframe-client -y                  # service removed, device deregistered
```

Repeat install and uninstall once on a VM that never ran `auth`; the community repository's verifier tests exactly that.

## Publishing

```powershell
choco apikey add --source https://push.chocolatey.org/ --key <API key of the Openframe account>
choco push openframe-client.<version>.nupkg --source https://push.chocolatey.org/
```

Moderation results arrive by email to the account. Fixes during review are pushed again under the same version; a package left waiting on the maintainer is rejected after 20 + 15 days.
