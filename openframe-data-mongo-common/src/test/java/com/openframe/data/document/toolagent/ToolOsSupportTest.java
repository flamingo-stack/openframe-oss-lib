package com.openframe.data.document.toolagent;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ToolOsSupportTest {

    private static final String MACOS_MINIMUM = "13.0";

    private IntegratedToolAgent agent;
    private Machine machine;

    @BeforeEach
    void setUp() {
        agent = new IntegratedToolAgent();
        agent.setKey("fleetmdm-agent");
        agent.setDownloadConfigurations(List.of(
                downloadConfiguration("windows", null),
                downloadConfiguration("macos", MACOS_MINIMUM)));
        machine = new Machine();
        machine.setMachineId("m-1");
        machine.setOsType(OsType.MAC_OS);
    }

    @ParameterizedTest
    @CsvSource({
            "11.7.10, 13.0",
            "12.7.6, 13",
            "13.0, 13.0.1",
            "13.1, 13.10",
            "9, 10",
            "13.0.0.1, 13.0.0.2",
            "13.9.9.9, 14",
            "' 12.0 ', 13.0"
    })
    void isBelow_versionUnderMinimum_true(String osVersion, String minOsVersion) {
        // setup

        // execution
        boolean below = ToolOsSupport.isBelow(osVersion, minOsVersion);

        // verifications
        assertThat(below).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "13, 13.0.0",
            "13.0.0.0, 13",
            "13.0, 13.0",
            "14.2, 13.0",
            "13.0.1, 13.0",
            "13.10, 13.9",
            "13.0.0.2, 13.0.0.1"
    })
    void isBelow_versionAtOrAboveMinimum_false(String osVersion, String minOsVersion) {
        // setup

        // execution
        boolean below = ToolOsSupport.isBelow(osVersion, minOsVersion);

        // verifications
        assertThat(below).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "12.7.6 (21H1320)", "v12.7", "12.7-rc", "macOS 11.7", "12..7", "12.", ".12",
            "11.7.10.1.2", "1234567890.1", "-12.0"})
    void isBelow_unparsableVersion_falseAsUnknown(String osVersion) {
        // setup

        // execution
        boolean below = ToolOsSupport.isBelow(osVersion, MACOS_MINIMUM);

        // verifications
        assertThat(below).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "13.x", "macOS 13"})
    void isBelow_unparsableMinimum_falseAsUnknown(String minOsVersion) {
        // setup

        // execution
        boolean below = ToolOsSupport.isBelow("11.7.10", minOsVersion);

        // verifications
        assertThat(below).isFalse();
    }

    @Test
    void minOsVersion_macMachine_macosMinimumReturned() {
        // setup

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, OsType.MAC_OS);

        // verifications
        assertThat(minimum).contains(MACOS_MINIMUM);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MACOS", "MacOS", "macOS"})
    void minOsVersion_osKeyInOtherCase_matchedCaseInsensitively(String os) {
        // setup
        agent.setDownloadConfigurations(List.of(downloadConfiguration(os, MACOS_MINIMUM)));

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, OsType.MAC_OS);

        // verifications
        assertThat(minimum).contains(MACOS_MINIMUM);
    }

    @Test
    void minOsVersion_windowsMachineWithoutWindowsMinimum_empty() {
        // setup

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, OsType.WINDOWS);

        // verifications
        assertThat(minimum).isEmpty();
    }

    @Test
    void minOsVersion_nullOsType_empty() {
        // setup

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, null);

        // verifications
        assertThat(minimum).isEmpty();
    }

    @Test
    void minOsVersion_noDownloadConfigurations_empty() {
        // setup
        agent.setDownloadConfigurations(null);

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, OsType.MAC_OS);

        // verifications
        assertThat(minimum).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void minOsVersion_blankMinimumOnTheOsEntry_ignored(String blankMinimum) {
        // setup
        agent.setDownloadConfigurations(List.of(downloadConfiguration("macos", blankMinimum)));

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, OsType.MAC_OS);

        // verifications
        assertThat(minimum).isEmpty();
    }

    @Test
    void minOsVersion_blankEntryBeforeAnEntryWithMinimum_minimumOfTheLaterEntryReturned() {
        // setup
        agent.setDownloadConfigurations(List.of(
                downloadConfiguration("macos", " "),
                downloadConfiguration("macos", MACOS_MINIMUM)));

        // execution
        Optional<String> minimum = ToolOsSupport.minOsVersion(agent, OsType.MAC_OS);

        // verifications
        assertThat(minimum).contains(MACOS_MINIMUM);
    }

    @Test
    void hasMinOsVersion_oneEntryWithMinimum_true() {
        // setup

        // execution
        boolean hasMinimum = ToolOsSupport.hasMinOsVersion(agent);

        // verifications
        assertThat(hasMinimum).isTrue();
    }

    @Test
    void hasMinOsVersion_onlyBlankOrMissingMinimums_false() {
        // setup
        agent.setDownloadConfigurations(List.of(
                downloadConfiguration("windows", null),
                downloadConfiguration("macos", " ")));

        // execution
        boolean hasMinimum = ToolOsSupport.hasMinOsVersion(agent);

        // verifications
        assertThat(hasMinimum).isFalse();
    }

    @Test
    void hasMinOsVersion_noDownloadConfigurations_false() {
        // setup
        agent.setDownloadConfigurations(null);

        // execution
        boolean hasMinimum = ToolOsSupport.hasMinOsVersion(agent);

        // verifications
        assertThat(hasMinimum).isFalse();
    }

    @Test
    void isUnsupported_macBelowMacosMinimum_true() {
        // setup
        machine.setOsVersion("11.7.10");

        // execution
        boolean unsupported = ToolOsSupport.isUnsupported(machine, agent);

        // verifications
        assertThat(unsupported).isTrue();
    }

    @Test
    void isUnsupported_macAtMacosMinimum_false() {
        // setup
        machine.setOsVersion("13.0");

        // execution
        boolean unsupported = ToolOsSupport.isUnsupported(machine, agent);

        // verifications
        assertThat(unsupported).isFalse();
    }

    @Test
    void isUnsupported_windowsMachineUnderTheMacosNumber_false() {
        // setup
        machine.setOsType(OsType.WINDOWS);
        machine.setOsVersion("10.0.19045");

        // execution
        boolean unsupported = ToolOsSupport.isUnsupported(machine, agent);

        // verifications
        assertThat(unsupported).isFalse();
    }

    @Test
    void isUnsupported_nullOsType_false() {
        // setup
        machine.setOsType(null);
        machine.setOsVersion("11.7.10");

        // execution
        boolean unsupported = ToolOsSupport.isUnsupported(machine, agent);

        // verifications
        assertThat(unsupported).isFalse();
    }

    @Test
    void isUnsupported_unknownMacVersion_false() {
        // setup
        machine.setOsVersion(null);

        // execution
        boolean unsupported = ToolOsSupport.isUnsupported(machine, agent);

        // verifications
        assertThat(unsupported).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            "MAC_OS, macos",
            "WINDOWS, windows"
    })
    void downloadOs_knownOsType_downloadKeyReturned(OsType osType, String expected) {
        // setup

        // execution
        Optional<String> os = ToolOsSupport.downloadOs(osType);

        // verifications
        assertThat(os).contains(expected);
    }

    @Test
    void downloadOs_nullOsType_empty() {
        // setup

        // execution
        Optional<String> os = ToolOsSupport.downloadOs(null);

        // verifications
        assertThat(os).isEmpty();
    }

    private static DownloadConfiguration downloadConfiguration(String os, String minOsVersion) {
        DownloadConfiguration configuration = new DownloadConfiguration();
        configuration.setOs(os);
        configuration.setMinOsVersion(minOsVersion);
        return configuration;
    }
}
