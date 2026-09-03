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

    public PackageScript installScript(PackageDetails details, String version) {
        return switch (details.getPackageManager()) {
            case BREW -> brewScript("install", details);
            case CHOCO -> chocoScript(chocoInstallCommand(details, version));
            case WINGET -> wingetScript(wingetInstallCommand(details, version));
        };
    }

    public PackageScript uninstallScript(PackageDetails details) {
        return switch (details.getPackageManager()) {
            case BREW -> brewScript("uninstall", details);
            case CHOCO -> chocoScript("choco uninstall '" + details.getId() + "' -y");
            case WINGET -> wingetScript("winget uninstall -e --id '" + details.getId() + "' --silent");
        };
    }

    // brew refuses to run under root, so it executes as the console user
    private static PackageScript brewScript(String action, PackageDetails details) {
        String caskFlag = details.getPackageType() == BrewPackageType.CASK ? " --cask" : "";
        String code = BREW_PATH_EXPORT + "\n"
                + "brew " + action + caskFlag + " '" + details.getId() + "'";
        return new PackageScript(code, ScriptShell.BASH, PrivilegeLevel.USER);
    }

    private static String chocoInstallCommand(PackageDetails details, String version) {
        String versionFlag = version == null ? "" : " --version '" + version + "'";
        return "choco install '" + details.getId() + "'" + versionFlag + " -y --no-progress";
    }

    private static PackageScript chocoScript(String command) {
        String code = command + "\n" + POWERSHELL_EXIT;
        return new PackageScript(code, ScriptShell.POWERSHELL, PrivilegeLevel.ADMIN);
    }

    private static String wingetInstallCommand(PackageDetails details, String version) {
        String versionFlag = version == null ? "" : " --version '" + version + "'";
        return "winget install -e --id '" + details.getId() + "'" + versionFlag
                + " --silent --accept-package-agreements --accept-source-agreements";
    }

    // winget is not available to the SYSTEM account, so it executes as the console user
    private static PackageScript wingetScript(String command) {
        String code = command + "\n" + POWERSHELL_EXIT;
        return new PackageScript(code, ScriptShell.POWERSHELL, PrivilegeLevel.USER);
    }
}
