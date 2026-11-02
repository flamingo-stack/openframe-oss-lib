package com.openframe.core.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class StringsTest {

    @Test
    void lowerTrimmed_paddedMixedCase_returnsItTrimmedAndLowerCased() {
        assertThat(Strings.lowerTrimmed("  John.Doe@Example.COM ")).isEqualTo("john.doe@example.com");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n"})
    void lowerTrimmed_nullOrBlank_returnsNull(String value) {
        assertThat(Strings.lowerTrimmed(value)).isNull();
    }
}
