package com.openframe.data.document.rmm.software;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FleetSourceTest {

    @Test
    void of_knownTable_itsSource() {
        assertThat(FleetSource.of("programs")).isEqualTo(FleetSource.PROGRAMS);
        assertThat(FleetSource.of("homebrew_packages")).isEqualTo(FleetSource.HOMEBREW_PACKAGES);
    }

    @Test
    void of_unknownOrMissingTable_other() {
        assertThat(FleetSource.of("some_new_table")).isEqualTo(FleetSource.OTHER);
        assertThat(FleetSource.of(null)).isEqualTo(FleetSource.OTHER);
        assertThat(FleetSource.of("")).isEqualTo(FleetSource.OTHER);
    }
}
