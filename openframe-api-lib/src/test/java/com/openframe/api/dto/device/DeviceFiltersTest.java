package com.openframe.api.dto.device;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceFiltersTest {

    @Test
    @DisplayName("a built DeviceFilters has empty MDM and disk encryption options, never null")
    void builder_mdmOptionsEmpty() {
        // execution
        DeviceFilters filters = DeviceFilters.builder().filteredCount(0).build();

        // verifications
        assertThat(filters.getMdmStates()).isEmpty();
        assertThat(filters.getDiskEncryptionStates()).isEmpty();
    }

    @Test
    @DisplayName("a DeviceFilters made with the no-args constructor has empty MDM and disk encryption options")
    void noArgsConstructor_mdmOptionsEmpty() {
        // execution
        DeviceFilters filters = new DeviceFilters();

        // verifications
        assertThat(filters.getMdmStates()).isEmpty();
        assertThat(filters.getDiskEncryptionStates()).isEmpty();
    }
}
