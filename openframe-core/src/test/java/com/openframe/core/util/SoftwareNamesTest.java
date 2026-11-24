package com.openframe.core.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.List;

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

    @ParameterizedTest
    @ValueSource(strings = {"${{arpDisplayName}}", "${{ arpDisplayName }}", "Contoso ${{productVersion}}",
            "{8A69D345-D564-463C-AFF1-A69D9E530F96}", "8a69d345-d564-463c-aff1-a69d9e530f96"})
    void placeholderOrGuidOnlyName_fallsBackToTheBundleIdentifier(String name) {
        // execution
        String displayName = SoftwareNames.displayName(name, "com.contoso.agent");

        // verifications
        assertThat(displayName).isEqualTo("com.contoso.agent");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\u200B", "${{arpDisplayName}}", "${{ arpDisplayName }}", "Contoso ${{productVersion}}",
            "{8A69D345-D564-463C-AFF1-A69D9E530F96}", "8a69d345-d564-463c-aff1-a69d9e530f96",
            " {8A69D345-D564-463C-AFF1-A69D9E530F96}\u00A0"})
    void displayable_placeholderGuidOnlyOrInvisibleName_isNoName(String name) {
        // execution
        String displayable = SoftwareNames.displayable(name);

        // verifications
        assertThat(displayable).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Google Chrome", "{Contoso} Agent", "Agent 8a69d345-d564-463c-aff1-a69d9e530f96",
            "$ {{not a placeholder}}", "8a69d345-d564-463c-aff1"})
    void displayable_realName_isKept(String name) {
        // execution
        String displayable = SoftwareNames.displayable(name);

        // verifications
        assertThat(displayable).isEqualTo(name);
    }

    @Test
    void displayable_realNameWithInvisibleEdges_isStripped() {
        // execution
        String displayable = SoftwareNames.displayable("\u200B Visual Studio Code\u00A0");

        // verifications
        assertThat(displayable).isEqualTo("Visual Studio Code");
    }

    @Test
    void firstDisplayable_skipsNamesThatAreNoName() {
        // setup
        List<String> names = Arrays.asList(null, "${{arpDisplayName}}", "{8A69D345-D564-463C-AFF1-A69D9E530F96}",
                "Contoso Agent", "Contoso Agent (x64)");

        // execution
        String first = SoftwareNames.firstDisplayable(names);

        // verifications
        assertThat(first).isEqualTo("Contoso Agent");
    }

    @Test
    void firstDisplayable_onlyNamesThatAreNoName_isNoName() {
        // setup
        List<String> names = List.of("${{arpDisplayName}}", " ");

        // execution
        String first = SoftwareNames.firstDisplayable(names);

        // verifications
        assertThat(first).isNull();
    }

    @Test
    void firstDisplayable_noNames_isNoName() {
        // execution
        String first = SoftwareNames.firstDisplayable(null);

        // verifications
        assertThat(first).isNull();
    }
}
