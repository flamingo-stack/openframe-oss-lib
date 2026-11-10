package com.openframe.core.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class SoftwareNamesTest {

    @Test
    void visibleName_wins() {
        assertThat(SoftwareNames.displayName("Google Chrome", "com.google.Chrome")).isEqualTo("Google Chrome");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\t\n", "\u00A0", "\u200B", "\u200E", "\u2060", "\uFEFF", " \u200B\u00A0 ", "\u0007"})
    void invisibleName_fallsBackToTheBundleIdentifier(String invisible) {
        assertThat(SoftwareNames.displayName(invisible, "com.apple.SettingsPlaceholder"))
                .isEqualTo("com.apple.SettingsPlaceholder");
    }

    @Test
    void stripsInvisibleCharactersAtTheEdges_keepsTheInside() {
        assertThat(SoftwareNames.displayName("\u200B Visual Studio Code\u00A0", null)).isEqualTo("Visual Studio Code");
        assertThat(SoftwareNames.displayName("Foo\u200DBar", null)).isEqualTo("Foo\u200DBar");
    }

    @Test
    void nothingVisible_isUnnamed() {
        assertThat(SoftwareNames.displayName("\u200B", " ")).isEqualTo(SoftwareNames.UNNAMED);
        assertThat(SoftwareNames.displayName(null, null)).isEqualTo(SoftwareNames.UNNAMED);
    }
}
