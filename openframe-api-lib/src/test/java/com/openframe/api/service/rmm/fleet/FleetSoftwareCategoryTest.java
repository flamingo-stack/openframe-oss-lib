package com.openframe.api.service.rmm.fleet;

import com.openframe.api.dto.rmm.software.SoftwareSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FleetSoftwareCategoryTest {

    @Test
    void of_managerTable_itsManager() {
        assertThat(FleetSoftwareCategory.of("chocolatey_packages").source()).isEqualTo(SoftwareSource.CHOCOLATEY);
        assertThat(FleetSoftwareCategory.of("homebrew_packages").source()).isEqualTo(SoftwareSource.BREW);
        assertThat(FleetSoftwareCategory.of("winget_packages").source()).isEqualTo(SoftwareSource.WINGET);
    }

    @Test
    void of_otherOrMissingTable_unmanaged() {
        assertThat(FleetSoftwareCategory.of("programs")).isEqualTo(FleetSoftwareCategory.OTHER);
        assertThat(FleetSoftwareCategory.of(null)).isEqualTo(FleetSoftwareCategory.OTHER);
    }

    @Test
    void managerSources_theManagerTablesOnly() {
        assertThat(FleetSoftwareCategory.managerSources())
                .containsExactlyInAnyOrder("chocolatey_packages", "homebrew_packages", "winget_packages");
    }
}
