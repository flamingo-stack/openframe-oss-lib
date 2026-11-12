package com.openframe.api.service.rmm.fleet;

import com.openframe.api.dto.rmm.software.SoftwareType;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FleetSoftwareTypeTest {

    @ParameterizedTest
    @CsvSource({
            "apps, APPLICATION",
            "programs, APPLICATION",
            "chrome_extensions, BROWSER_EXTENSION",
            "firefox_addons, BROWSER_EXTENSION",
            "homebrew_packages, PACKAGE",
            "chocolatey_packages, PACKAGE",
            "winget_packages, PACKAGE",
            "deb_packages, PACKAGE",
            "python_packages, PACKAGE",
            "vscode_extensions, OTHER",
            "something_new, OTHER"
    })
    void typeFollowsTheFleetSource(String fleetSource, SoftwareType expected) {
        assertThat(FleetSoftwareType.of(fleetSource)).isEqualTo(expected);
    }

    @Test
    void noSource_noType() {
        assertThat(FleetSoftwareType.of(null)).isNull();
    }
}
