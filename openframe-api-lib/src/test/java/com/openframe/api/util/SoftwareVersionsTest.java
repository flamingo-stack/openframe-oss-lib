package com.openframe.api.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class SoftwareVersionsTest {

    @ParameterizedTest
    @CsvSource({"9.0,10.0", "1.2,1.2.1", "2.53.0,2.56.0_2", "1.2.2,1.2.3-beta", "1.0,20240101123456.0", "2.56.0_1,2.56.0_2"})
    void lowerComesFirst(String lower, String higher) {
        assertThat(SoftwareVersions.compare(lower, higher)).isNegative();
        assertThat(SoftwareVersions.compare(higher, lower)).isPositive();
    }

    @Test
    void sameVersion_isEqual() {
        assertThat(SoftwareVersions.compare("1.2.3", "1.2.3")).isZero();
    }
}
