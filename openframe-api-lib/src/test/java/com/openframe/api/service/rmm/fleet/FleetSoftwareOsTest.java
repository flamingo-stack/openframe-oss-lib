package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.FleetSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class FleetSoftwareOsTest {

    @ParameterizedTest
    @CsvSource({
            "PROGRAMS, WINDOWS",
            "CHOCOLATEY_PACKAGES, WINDOWS",
            "WINGET_PACKAGES, WINDOWS",
            "IE_EXTENSIONS, WINDOWS",
            "APPS, MAC_OS",
            "HOMEBREW_PACKAGES, MAC_OS",
            "SAFARI_EXTENSIONS, MAC_OS",
            "PKG_PACKAGES, MAC_OS",
            "DEB_PACKAGES,",
            "RPM_PACKAGES,",
            "PORTAGE_PACKAGES,",
            "NPM_PACKAGES,",
            "PYTHON_PACKAGES,",
            "ATOM_PACKAGES,",
            "GO_BINARIES,",
            "CHROME_EXTENSIONS,",
            "FIREFOX_ADDONS,",
            "VSCODE_EXTENSIONS,",
            "JETBRAINS_PLUGINS,",
            "OTHER,"
    })
    void of_fleetSource_systemOfItsTableOrNone(FleetSource fleetSource, OsType expected) {
        // execution
        OsType os = FleetSoftwareOs.of(fleetSource);

        // verifications
        assertThat(os).isEqualTo(expected);
    }

    @Test
    void of_noFleetSource_noSystem() {
        // execution
        OsType os = FleetSoftwareOs.of(null);

        // verifications
        assertThat(os).isNull();
    }

    @Test
    void fleetSources_chosenSystems_fleetNamesOfTheirTables() {
        // setup
        List<OsType> windows = List.of(OsType.WINDOWS);
        List<OsType> macOs = List.of(OsType.MAC_OS);

        // execution
        Set<String> windowsSources = FleetSoftwareOs.fleetSources(windows);
        Set<String> macOsSources = FleetSoftwareOs.fleetSources(macOs);

        // verifications
        assertThat(windowsSources)
                .containsExactlyInAnyOrder("programs", "chocolatey_packages", "winget_packages", "ie_extensions");
        assertThat(macOsSources)
                .containsExactlyInAnyOrder("apps", "homebrew_packages", "safari_extensions", "pkg_packages");
    }
}
