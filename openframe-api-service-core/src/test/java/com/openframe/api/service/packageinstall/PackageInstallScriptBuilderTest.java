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
        PackageScript script = builder.installScript(details(PackageManagerType.BREW, "slack", BrewPackageType.CASK), null);

        assertEquals(ScriptShell.BASH, script.shell());
        assertEquals(PrivilegeLevel.USER, script.privilegeLevel());
        assertTrue(script.code().contains("export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\""));
        assertTrue(script.code().contains("brew install --cask 'slack'"));
    }

    @Test
    void brewFormulaInstallHasNoCaskFlag() {
        PackageScript script = builder.installScript(details(PackageManagerType.BREW, "wireshark", BrewPackageType.FORMULA), null);

        assertTrue(script.code().contains("brew install 'wireshark'"));
        assertFalse(script.code().contains("--cask"));
    }

    @Test
    void brewUninstallKeepsCaskFlag() {
        PackageScript script = builder.uninstallScript(details(PackageManagerType.BREW, "slack", BrewPackageType.CASK));

        assertTrue(script.code().contains("brew uninstall --cask 'slack'"));
        assertEquals(PrivilegeLevel.USER, script.privilegeLevel());
    }

    @Test
    void chocoInstallIsNonInteractiveAdminAndForwardsExitCode() {
        PackageScript script = builder.installScript(details(PackageManagerType.CHOCO, "7zip", null), null);

        assertEquals(ScriptShell.POWERSHELL, script.shell());
        assertEquals(PrivilegeLevel.ADMIN, script.privilegeLevel());
        assertTrue(script.code().contains("choco install '7zip' -y --no-progress"));
        assertTrue(script.code().endsWith("exit $LASTEXITCODE"));
    }

    @Test
    void chocoInstallPinsRequestedVersion() {
        PackageScript script = builder.installScript(details(PackageManagerType.CHOCO, "7zip", null), "22.1.0");

        assertTrue(script.code().contains("choco install '7zip' --version '22.1.0' -y --no-progress"));
    }

    @Test
    void chocoUninstallIsNonInteractive() {
        PackageScript script = builder.uninstallScript(details(PackageManagerType.CHOCO, "7zip", null));

        assertTrue(script.code().contains("choco uninstall '7zip' -y"));
    }

    @Test
    void wingetInstallIsSilentConsoleUserAndAcceptsAgreements() {
        PackageScript script = builder.installScript(details(PackageManagerType.WINGET, "Mozilla.Firefox", null), null);

        assertEquals(ScriptShell.POWERSHELL, script.shell());
        assertEquals(PrivilegeLevel.USER, script.privilegeLevel());
        assertTrue(script.code().contains(
                "winget install -e --id 'Mozilla.Firefox' --silent --accept-package-agreements --accept-source-agreements"));
        assertTrue(script.code().endsWith("exit $LASTEXITCODE"));
    }

    @Test
    void wingetInstallPinsRequestedVersion() {
        PackageScript script = builder.installScript(details(PackageManagerType.WINGET, "Mozilla.Firefox", null), "155.0");

        assertTrue(script.code().contains("winget install -e --id 'Mozilla.Firefox' --version '155.0' --silent"));
    }

    @Test
    void wingetUninstallIsSilent() {
        PackageScript script = builder.uninstallScript(details(PackageManagerType.WINGET, "Mozilla.Firefox", null));

        assertTrue(script.code().contains("winget uninstall -e --id 'Mozilla.Firefox' --silent"));
    }

    private static PackageDetails details(PackageManagerType manager, String id, BrewPackageType packageType) {
        return PackageDetails.builder()
                .id(id)
                .packageManager(manager)
                .packageType(packageType)
                .build();
    }
}
