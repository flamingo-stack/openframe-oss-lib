package com.openframe.core.clientversion;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class BundleVersionsTest {

    @ParameterizedTest
    @CsvSource({
            "1.0.100,             1.0.120",
            "1.0.119-3-gabcdef0,  1.0.120",
            "1.0.9,               1.0.10",
            "1.9.0,               1.10.0",
            "0.9.9,               1.0.0",
            "1.0.119,             1.0.120-rc1"
    })
    void isBelow_versionLowerThanMinimum_returnsTrue(String version, String minimum) {
        // setup - versions prepared by the source

        // execution
        boolean below = BundleVersions.isBelow(version, minimum);

        // verifications
        assertThat(below).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "1.0.120,                  1.0.120",
            "1.0.125-4-geae0416-dirty, 1.0.125",
            "1.0.130,                  1.0.120",
            "1.0.10,                   1.0.9",
            "1.10.0,                   1.9.0",
            "2.0.0,                    1.99.99"
    })
    void isBelow_versionEqualOrHigher_returnsFalse(String version, String minimum) {
        // setup - versions prepared by the source

        // execution
        boolean below = BundleVersions.isBelow(version, minimum);

        // verifications
        assertThat(below).isFalse();
    }

    @ParameterizedTest
    @CsvSource(value = {
            "-,                    1.0.120",
            "'',                   1.0.120",
            "1.0,                  1.0.120",
            "v1.0.100,             1.0.120",
            "abc,                  1.0.120",
            "99999999999.0.0,      1.0.120",
            "NULL,                 1.0.120",
            "1.0.100,              NULL",
            "1.0.100,              ''",
            "1.0.100,              -",
            "1.0.100,              1.0"
    }, nullValues = "NULL")
    void isBelow_eitherSideDoesNotParse_returnsFalse(String version, String minimum) {
        // setup - versions prepared by the source

        // execution
        boolean below = BundleVersions.isBelow(version, minimum);

        // verifications
        assertThat(below).isFalse();
    }
}
