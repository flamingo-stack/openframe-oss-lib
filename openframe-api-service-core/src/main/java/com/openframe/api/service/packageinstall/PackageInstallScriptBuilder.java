package com.openframe.api.service.packageinstall;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import org.springframework.stereotype.Component;

@Component
public class PackageInstallScriptBuilder {

    // launchd daemons start with a bare PATH that has no Homebrew prefix
    private static final String BREW_PATH_EXPORT = "export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\"";
    // powershell -File exits 0 unless the script forwards the tool's exit code
    private static final String POWERSHELL_EXIT = "exit $LASTEXITCODE";

    public PackageScript buildInstallScript(PackageDetails details, String version) {
        return switch (details.getPackageManager()) {
            case BREW -> brewScript("install", details);
            case CHOCO -> chocoInstall(details, version);
            case WINGET -> wingetInstall(details, version);
        };
    }

    public PackageScript buildUninstallScript(PackageDetails details) {
        return switch (details.getPackageManager()) {
            case BREW -> brewScript("uninstall", details);
            case CHOCO -> chocoUninstall(details);
            case WINGET -> wingetUninstall(details);
        };
    }

    // brew refuses to run under root, so both actions execute as the console user
    private static PackageScript brewScript(String action, PackageDetails details) {
        String caskFlag = details.getPackageType() == BrewPackageType.CASK ? " --cask" : "";
        String code = BREW_PATH_EXPORT + "\n"
                + "brew " + action + caskFlag + " '" + details.getId() + "'";
        return new PackageScript(code, ScriptShell.BASH, PrivilegeLevel.USER);
    }

    private static PackageScript chocoInstall(PackageDetails details, String version) {
        String command = "choco install '" + details.getId() + "'" + versionFlag(version) + " -y --no-progress";
        return powershellScript(command, PrivilegeLevel.ADMIN);
    }

    private static PackageScript chocoUninstall(PackageDetails details) {
        String command = "choco uninstall '" + details.getId() + "' -y";
        return powershellScript(command, PrivilegeLevel.ADMIN);
    }

    // winget is unavailable to the SYSTEM account, so both actions execute as the console user
    private static PackageScript wingetInstall(PackageDetails details, String version) {
        String command = "winget install -e --id '" + details.getId() + "'" + versionFlag(version)
                + " --silent --accept-package-agreements --accept-source-agreements";
        return powershellScript(command, PrivilegeLevel.USER);
    }

    // the source-agreement prompt can appear on any winget run, not only installs
    private static PackageScript wingetUninstall(PackageDetails details) {
        String command = "winget uninstall -e --id '" + details.getId() + "' --silent --accept-source-agreements";
        return powershellScript(command, PrivilegeLevel.USER);
    }

    private static String versionFlag(String version) {
        return version == null ? "" : " --version '" + version + "'";
    }

    private static PackageScript powershellScript(String command, PrivilegeLevel privilegeLevel) {
        String code = command + "\n" + POWERSHELL_EXIT;
        return new PackageScript(code, ScriptShell.POWERSHELL, privilegeLevel);
    }
}
