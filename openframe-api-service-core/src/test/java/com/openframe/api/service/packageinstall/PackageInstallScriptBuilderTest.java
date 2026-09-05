package com.openframe.api.service.packageinstall;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PackageInstallScriptBuilderTest {

    private final PackageInstallScriptBuilder builder = new PackageInstallScriptBuilder();

    @Test
    void brewCaskInstallRunsAsConsoleUserWithHomebrewOnPath() {
        PackageScript script = builder.buildInstallScript(details(PackageManagerType.BREW, "slack", BrewPackageType.CASK), null);

        assertEquals(ScriptShell.BASH, script.getShell());
        assertEquals(PrivilegeLevel.USER, script.getPrivilegeLevel());
        assertTrue(script.getCode().contains("export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\""));
        assertTrue(script.getCode().contains("brew install --cask 'slack'"));
    }

    @Test
    void brewFormulaInstallHasNoCaskFlag() {
        PackageScript script = builder.buildInstallScript(details(PackageManagerType.BREW, "wireshark", BrewPackageType.FORMULA), null);

        assertTrue(script.getCode().contains("brew install 'wireshark'"));
        assertFalse(script.getCode().contains("--cask"));
    }

    @Test
    void brewUninstallKeepsCaskFlag() {
        PackageScript script = builder.buildUninstallScript(details(PackageManagerType.BREW, "slack", BrewPackageType.CASK));

        assertTrue(script.getCode().contains("brew uninstall --cask 'slack'"));
        assertEquals(PrivilegeLevel.USER, script.getPrivilegeLevel());
    }

    @Test
    void chocoInstallIsNonInteractiveAdminAndForwardsExitCode() {
        PackageScript script = builder.buildInstallScript(details(PackageManagerType.CHOCO, "7zip", null), null);

        assertEquals(ScriptShell.POWERSHELL, script.getShell());
        assertEquals(PrivilegeLevel.ADMIN, script.getPrivilegeLevel());
        assertTrue(script.getCode().contains("choco install '7zip' -y --no-progress"));
        assertTrue(script.getCode().endsWith("exit $LASTEXITCODE"));
    }

    @Test
    void chocoInstallPinsRequestedVersion() {
        PackageScript script = builder.buildInstallScript(details(PackageManagerType.CHOCO, "7zip", null), "22.1.0");

        assertTrue(script.getCode().contains("choco install '7zip' --version '22.1.0' -y --no-progress"));
    }

    @Test
    void chocoUninstallIsNonInteractive() {
        PackageScript script = builder.buildUninstallScript(details(PackageManagerType.CHOCO, "7zip", null));

        assertTrue(script.getCode().contains("choco uninstall '7zip' -y"));
    }

    @Test
    void wingetInstallIsSilentConsoleUserAndAcceptsAgreements() {
        PackageScript script = builder.buildInstallScript(details(PackageManagerType.WINGET, "Mozilla.Firefox", null), null);

        assertEquals(ScriptShell.POWERSHELL, script.getShell());
        assertEquals(PrivilegeLevel.USER, script.getPrivilegeLevel());
        assertTrue(script.getCode().contains(
                "winget install -e --id 'Mozilla.Firefox' --silent --accept-package-agreements --accept-source-agreements"));
        assertTrue(script.getCode().endsWith("exit $LASTEXITCODE"));
    }

    @Test
    void wingetInstallPinsRequestedVersion() {
        PackageScript script = builder.buildInstallScript(details(PackageManagerType.WINGET, "Mozilla.Firefox", null), "155.0");

        assertTrue(script.getCode().contains("winget install -e --id 'Mozilla.Firefox' --version '155.0' --silent"));
    }

    @Test
    void wingetUninstallIsSilent() {
        PackageScript script = builder.buildUninstallScript(details(PackageManagerType.WINGET, "Mozilla.Firefox", null));

        assertTrue(script.getCode().contains("winget uninstall -e --id 'Mozilla.Firefox' --silent --accept-source-agreements"));
    }

    private static PackageDetails details(PackageManagerType manager, String id, BrewPackageType packageType) {
        return PackageDetails.builder()
                .id(id)
                .packageManager(manager)
                .packageType(packageType)
                .build();
    }
}
