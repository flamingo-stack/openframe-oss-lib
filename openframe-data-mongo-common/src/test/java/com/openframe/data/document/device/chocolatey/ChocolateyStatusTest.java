package com.openframe.data.document.device.chocolatey;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ChocolateyStatusTest {

    @ParameterizedTest
    @CsvSource({
            "MANAGED,          MANAGED",
            "UPGRADE_REQUIRED, UPGRADE_REQUIRED",
            "ACTION_REQUIRED,  ACTION_REQUIRED",
            "UNKNOWN,          UNKNOWN"
    })
    void fromWire_exactName_thatStatus(String wireValue, ChocolateyStatus expected) {
        // execution
        ChocolateyStatus status = ChocolateyStatus.fromWire(wireValue);

        // verifications
        assertThat(status).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "managed", "Managed", " MANAGED", "MANAGED ", "UPGRADE-REQUIRED", "QUARANTINED"})
    void fromWire_unknownOrNull_unknown(String wireValue) {
        // execution
        ChocolateyStatus status = ChocolateyStatus.fromWire(wireValue);

        // verifications
        assertThat(status).isEqualTo(ChocolateyStatus.UNKNOWN);
    }
}
