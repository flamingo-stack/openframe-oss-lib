package com.openframe.data.document.device;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ClientVersionKeyTest {

    @ParameterizedTest
    @CsvSource({
            "1.6.0,          1000006000000",
            "1.6,            1000006000000",
            "1,              1000000000000",
            "0.0.0,          0",
            "0.0.1,          1",
            "1.5.999999,     1000005999999",
            "1.6.23,         1000006000023",
            "2.0.0,          2000000000000",
            "10.20.30,       10000020000030",
            "999999.999999.999999, 999999999999999999",
            "01.06.00,       1000006000000"
    })
    void parse_numericTriple_majorMinorPatchKey(String version, long expected) {
        // execution
        Long key = ClientVersionKey.parse(version);

        // verifications
        assertThat(key).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"v1.6.0", "V1.6.0", " 1.6.0 ", "1.6.0-beta", "1.6.0+build.7", "1.6.0.5", "1.6.0-rc.1",
            "1.6-beta", "v1.6", "1.6.0 (darwin)"})
    void parse_prefixOrSuffixAroundTriple_ignored(String version) {
        // execution
        Long key = ClientVersionKey.parse(version);

        // verifications
        assertThat(key).isEqualTo(1_000_006_000_000L);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "v", "beta", "latest", "-1.6.0", ".6.0", "x1.6.0", "version 1.6.0", "vv1.6.0"})
    void parse_noLeadingNumber_null(String version) {
        // execution
        Long key = ClientVersionKey.parse(version);

        // verifications
        assertThat(key).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"1234567.0.0", "1.1234567.0", "1.6.1234567", "99999999999999999999.0.0"})
    void parse_partWiderThanSixDigits_null(String version) {
        // execution
        Long key = ClientVersionKey.parse(version);

        // verifications
        assertThat(key).isNull();
    }

    @Test
    void parse_lastPatchOfAMinor_sortsBelowNextMinor() {
        // setup
        Long lastPatch = ClientVersionKey.parse("1.5.999999");

        // execution
        Long nextMinor = ClientVersionKey.parse("1.6.0");

        // verifications
        assertThat(lastPatch).isLessThan(nextMinor);
    }

    @Test
    void parse_minorTen_sortsAboveMinorNine() {
        // setup
        Long minorNine = ClientVersionKey.parse("1.9.0");

        // execution
        Long minorTen = ClientVersionKey.parse("1.10.0");

        // verifications
        assertThat(minorTen).isGreaterThan(minorNine);
    }
}
