package com.openframe.data.document.rmm;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The platform ↔ {@code osType} vocabulary gap these aliases exist to close: the Rust agent
 * registers Macs as {@code "MAC_OS"}, so every comparison that read a platform NAME as if it were
 * an osType silently resolved to zero Macs — schedules offered no Mac in Available Devices,
 * rejected one added by hand, and dispatched to none.
 */
class ScriptPlatformTest {

    @ParameterizedTest
    @DisplayName("the spellings agents actually register Macs under all resolve to MACOS")
    @ValueSource(strings = {"MAC_OS", "mac_os", "MACOS", "macos", "Mac-OS", "mac os", "Darwin", "OSX", "Mac OS X"})
    void macSpellingsResolveToMacos(String osType) {
        assertThat(ScriptPlatform.fromOsType(osType)).contains(ScriptPlatform.MACOS);
        assertThat(ScriptPlatform.MACOS.matches(osType)).isTrue();
    }

    @Test
    @DisplayName("MAC_OS is not any other platform — the fix must not widen what a Mac matches")
    void macOsIsNotWindowsOrLinux() {
        assertThat(ScriptPlatform.WINDOWS.matches("MAC_OS")).isFalse();
        assertThat(ScriptPlatform.LINUX.matches("MAC_OS")).isFalse();
    }

    @ParameterizedTest
    @DisplayName("Windows and Linux keep resolving as they did")
    @ValueSource(strings = {"WINDOWS", "windows", "win32"})
    void windowsSpellings(String osType) {
        assertThat(ScriptPlatform.fromOsType(osType)).contains(ScriptPlatform.WINDOWS);
    }

    @Test
    @DisplayName("'darwin' is a Mac, not a Windows box — the 'win' alias must not match inside it")
    void darwinIsNotWindows() {
        assertThat(ScriptPlatform.WINDOWS.matches("darwin")).isFalse();
        assertThat(ScriptPlatform.fromOsType("darwin")).contains(ScriptPlatform.MACOS);
    }

    @Test
    @DisplayName("an unrecognised osType resolves to no platform and matches none")
    void unknownOsType() {
        assertThat(ScriptPlatform.fromOsType("plan9")).isEmpty();
        assertThat(ScriptPlatform.fromOsType(null)).isEmpty();
        assertThat(ScriptPlatform.fromOsType("  ")).isEmpty();
    }

    @Test
    @DisplayName("osTypeMatches: a platform name matches a device's stored osType across the spelling gap")
    void osTypeMatchesAcrossSpellings() {
        assertThat(ScriptPlatform.osTypeMatches("MACOS", "MAC_OS")).isTrue();
        assertThat(ScriptPlatform.osTypeMatches("MACOS", "WINDOWS")).isFalse();
        assertThat(ScriptPlatform.osTypeMatches("WINDOWS", "WINDOWS")).isTrue();
    }

    @Test
    @DisplayName("osTypeMatches: a name denoting no known platform still matches itself")
    void osTypeMatchesFallsBackToSelfComparison() {
        assertThat(ScriptPlatform.osTypeMatches("plan9", "PLAN9")).isTrue();
        assertThat(ScriptPlatform.osTypeMatches("plan9", "haiku")).isFalse();
        assertThat(ScriptPlatform.osTypeMatches(null, "MAC_OS")).isFalse();
        assertThat(ScriptPlatform.osTypeMatches("MACOS", null)).isFalse();
    }

    @Test
    @DisplayName("osTypeRegex: matches every stored Mac spelling, and nothing else")
    void osTypeRegexCoversStoredSpellings() {
        Pattern pattern = Pattern.compile(ScriptPlatform.osTypeRegex("MACOS"), Pattern.CASE_INSENSITIVE);

        assertThat(pattern.matcher("MAC_OS").matches()).isTrue();
        assertThat(pattern.matcher("macos").matches()).isTrue();
        assertThat(pattern.matcher("Darwin").matches()).isTrue();
        assertThat(pattern.matcher("WINDOWS").matches()).isFalse();
    }

    @Test
    @DisplayName("osTypeRegex: anchored, so a platform is never matched as a substring of another osType")
    void osTypeRegexIsAnchored() {
        Pattern windows = Pattern.compile(ScriptPlatform.osTypeRegex("WINDOWS"), Pattern.CASE_INSENSITIVE);

        assertThat(windows.matcher("darwin").matches()).isFalse();     // contains "win"
        assertThat(windows.matcher("windows 11").matches()).isFalse();
        assertThat(windows.matcher("WINDOWS").matches()).isTrue();
    }

    @Test
    @DisplayName("osTypeRegex: an unknown platform name is matched literally, metacharacters and all")
    void osTypeRegexQuotesUnknownNames() {
        Pattern pattern = Pattern.compile(ScriptPlatform.osTypeRegex("plan.9"), Pattern.CASE_INSENSITIVE);

        assertThat(pattern.matcher("plan.9").matches()).isTrue();
        assertThat(pattern.matcher("planX9").matches()).isFalse();     // '.' is not a wildcard here
    }
}
