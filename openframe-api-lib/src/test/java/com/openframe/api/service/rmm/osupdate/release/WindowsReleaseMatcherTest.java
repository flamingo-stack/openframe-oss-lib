package com.openframe.api.service.rmm.osupdate.release;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WindowsReleaseMatcherTest {

    private static final List<WindowsRelease> WINDOWS_RELEASES = List.of(
            release("11-24h2-iot-lts"), release("11-24h2-e-lts"), release("11-24h2-e"), release("11-24h2-w"),
            release("11-23h2-w"), release("10-22h2"), release("10-21h2-e"), release("10-21h2-w"),
            release("10-1809-e-lts"));

    private final WindowsReleaseMatcher windowsReleaseMatcher = new WindowsReleaseMatcher();

    @ParameterizedTest
    @CsvSource({
            "11 24H2, HOME_AND_PRO, 11-24h2-w",
            "11 24H2, ENTERPRISE_AND_EDUCATION, 11-24h2-e",
            "11 24H2, ENTERPRISE_LTSC, 11-24h2-e-lts",
            "11 24H2, IOT_ENTERPRISE_LTSC, 11-24h2-iot-lts",
            "10 21H2, HOME_AND_PRO, 10-21h2-w",
            "10 21H2, ENTERPRISE_AND_EDUCATION, 10-21h2-e",
            "10 1809, ENTERPRISE_LTSC, 10-1809-e-lts",
            "' 11  24h2 ', ENTERPRISE_AND_EDUCATION, 11-24h2-e"})
    void findWindowsRelease_reportedVersionAndEditionGroup_rowOfTheGroup(
            String osVersion, WindowsEditionGroup windowsEditionGroup, String expectedCycle) {
        // setup

        // execution
        WindowsRelease windowsRelease =
                windowsReleaseMatcher.findWindowsRelease(WINDOWS_RELEASES, osVersion, windowsEditionGroup);

        // verifications
        assertThat(windowsRelease.getCycle()).isEqualTo(expectedCycle);
    }

    @ParameterizedTest
    @EnumSource(WindowsEditionGroup.class)
    void findWindowsRelease_versionWithOneRowWithoutASuffix_thatRowForEveryEditionGroup(
            WindowsEditionGroup windowsEditionGroup) {
        // setup

        // execution
        WindowsRelease windowsRelease =
                windowsReleaseMatcher.findWindowsRelease(WINDOWS_RELEASES, "10 22H2", windowsEditionGroup);

        // verifications
        assertThat(windowsRelease.getCycle()).isEqualTo("10-22h2");
    }

    @ParameterizedTest
    @CsvSource({
            "11 23H2, ENTERPRISE_AND_EDUCATION",
            "10 21H2, ENTERPRISE_LTSC",
            "10 21H2, IOT_ENTERPRISE_LTSC",
            "10 1809, HOME_AND_PRO"})
    void findWindowsRelease_noRowOfTheEditionGroupAndNoneWithoutASuffix_empty(
            String osVersion, WindowsEditionGroup windowsEditionGroup) {
        // setup

        // execution
        WindowsRelease windowsRelease =
                windowsReleaseMatcher.findWindowsRelease(WINDOWS_RELEASES, osVersion, windowsEditionGroup);

        // verifications
        assertThat(windowsRelease).isNull();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"11 26H2", "26.1", ""})
    void findWindowsRelease_versionWithoutARow_empty(String osVersion) {
        // setup

        // execution
        WindowsRelease windowsRelease = windowsReleaseMatcher
                .findWindowsRelease(WINDOWS_RELEASES, osVersion, WindowsEditionGroup.HOME_AND_PRO);

        // verifications
        assertThat(windowsRelease).isNull();
    }

    @Test
    void findWindowsRelease_noReleases_empty() {
        // setup

        // execution
        WindowsRelease windowsRelease = windowsReleaseMatcher
                .findWindowsRelease(List.of(), "11 24H2", WindowsEditionGroup.HOME_AND_PRO);

        // verifications
        assertThat(windowsRelease).isNull();
    }

    private static WindowsRelease release(String cycle) {
        return WindowsRelease.builder().cycle(cycle).build();
    }
}
