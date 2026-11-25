package com.openframe.api.service.rmm.osupdate.release;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class WindowsReleaseMatcherTest {

    private static final List<WindowsRelease> WINDOWS_RELEASES = List.of(
            release("11-24h2-iot-lts"), release("11-24h2-e-lts"), release("11-24h2-e"), release("11-24h2-w"),
            release("10-22h2"), release("10-21h2-e"), release("10-21h2-w"));

    private final WindowsReleaseMatcher windowsReleaseMatcher = new WindowsReleaseMatcher();

    @ParameterizedTest
    @CsvSource({"11 24H2, 11-24h2-w", "10 22H2, 10-22h2", "10 21H2, 10-21h2-w", "' 11  24h2 ', 11-24h2-w"})
    void findWindowsRelease_reportedVersion_homeAndProRowOrTheOnlyRow(String osVersion, String expectedCycle) {
        // setup

        // execution
        Optional<WindowsRelease> windowsRelease = windowsReleaseMatcher.findWindowsRelease(WINDOWS_RELEASES, osVersion);

        // verifications
        assertThat(windowsRelease).map(WindowsRelease::getCycle).contains(expectedCycle);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"11 26H2", "26.1", ""})
    void findWindowsRelease_versionWithoutARow_empty(String osVersion) {
        // setup

        // execution
        Optional<WindowsRelease> windowsRelease = windowsReleaseMatcher.findWindowsRelease(WINDOWS_RELEASES, osVersion);

        // verifications
        assertThat(windowsRelease).isEmpty();
    }

    @Test
    void findWindowsRelease_noReleases_empty() {
        // setup

        // execution
        Optional<WindowsRelease> windowsRelease = windowsReleaseMatcher.findWindowsRelease(List.of(), "11 24H2");

        // verifications
        assertThat(windowsRelease).isEmpty();
    }

    private static WindowsRelease release(String cycle) {
        return WindowsRelease.builder().cycle(cycle).build();
    }
}
