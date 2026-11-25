package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.service.rmm.osupdate.release.WindowsRelease;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildCount;
import com.openframe.data.repository.rmm.osupdate.OsVersionDeviceCounts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OsVersionResponseMapperTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-25");
    private static final String LATEST_BUILD = "26100.9974";
    private static final WindowsRelease HOME_AND_PRO = WindowsRelease.builder()
            .cycle("11-24h2-w").latestBuild("26100").endOfSupportAt(LocalDate.parse("2026-10-13")).build();
    private static final WindowsRelease ENTERPRISE = WindowsRelease.builder()
            .cycle("11-24h2-e").latestBuild("26100").endOfSupportAt(LocalDate.parse("2027-10-12")).build();

    private final OsVersionResponseMapper osVersionResponseMapper = new OsVersionResponseMapper();

    private final OsVersionDeviceCounts osVersionDeviceCounts = new OsVersionDeviceCounts("11 24H2", List.of(
            new OsVersionBuildCount("26100.4061", 2), new OsVersionBuildCount("22631.1", 3),
            new OsVersionBuildCount("26100.9974", 4), new OsVersionBuildCount("26100.10075", 1),
            new OsVersionBuildCount(null, 1)));

    @Test
    void toResponse_bothReleasesAndALatestBuild_everyField() {
        // setup
        OsVersionResponse expected = OsVersionResponse.builder()
                .osVersion("11 24H2")
                .deviceCount(11)
                .devicesBehindCount(5)
                .currentBuild("26100.9974")
                .endOfSupportAt(LocalDate.parse("2026-10-13"))
                .supportEnded(true)
                .enterpriseEndOfSupportAt(LocalDate.parse("2027-10-12"))
                .enterpriseSupportEnded(false)
                .cursor("cursor-1")
                .build();

        // execution
        OsVersionResponse response = osVersionResponseMapper.toResponse(
                osVersionDeviceCounts, HOME_AND_PRO, ENTERPRISE, LATEST_BUILD, TODAY, "cursor-1");

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void toResponse_noLatestBuild_baseBuildOfTheReleaseAndNoDevicesBehind() {
        // setup

        // execution
        OsVersionResponse response = osVersionResponseMapper.toResponse(
                osVersionDeviceCounts, HOME_AND_PRO, ENTERPRISE, null, TODAY, "cursor-1");

        // verifications
        assertThat(response.getCurrentBuild()).isEqualTo("26100");
        assertThat(response.getDevicesBehindCount()).isNull();
        assertThat(response.getDeviceCount()).isEqualTo(11);
    }

    @Test
    void toResponse_onlyTheEnterpriseRelease_itsBaseBuildAndDateAndNoHomeAndProDate() {
        // setup

        // execution
        OsVersionResponse response = osVersionResponseMapper.toResponse(
                osVersionDeviceCounts, null, ENTERPRISE, null, TODAY, "cursor-1");

        // verifications
        assertThat(response.getCurrentBuild()).isEqualTo("26100");
        assertThat(response.getEndOfSupportAt()).isNull();
        assertThat(response.getSupportEnded()).isNull();
        assertThat(response.getEnterpriseEndOfSupportAt()).isEqualTo(LocalDate.parse("2027-10-12"));
        assertThat(response.getEnterpriseSupportEnded()).isFalse();
    }

    @ParameterizedTest
    @CsvSource({"2026-11-24, true", "2026-11-25, false", "2026-11-26, false"})
    void toResponse_endOfSupport_endedOnlyAfterTheDay(LocalDate endOfSupportAt, boolean expectedEnded) {
        // setup
        WindowsRelease windowsRelease = WindowsRelease.builder().cycle("c").endOfSupportAt(endOfSupportAt).build();

        // execution
        OsVersionResponse response = osVersionResponseMapper.toResponse(
                osVersionDeviceCounts, windowsRelease, windowsRelease, null, TODAY, "c");

        // verifications
        assertThat(response.getSupportEnded()).isEqualTo(expectedEnded);
        assertThat(response.getEnterpriseSupportEnded()).isEqualTo(expectedEnded);
    }

    @Test
    void toResponse_noReleaseAndNoLatestBuild_countsOnlyAndTheReferenceFieldsNull() {
        // setup

        // execution
        OsVersionResponse response =
                osVersionResponseMapper.toResponse(osVersionDeviceCounts, null, null, null, TODAY, "cursor-1");

        // verifications
        assertThat(response).isEqualTo(OsVersionResponse.builder()
                .osVersion("11 24H2").deviceCount(11).cursor("cursor-1").build());
    }

    @Test
    void toResponse_latestBuildWithoutARelease_buildFieldsWithoutTheEndOfSupport() {
        // setup

        // execution
        OsVersionResponse response =
                osVersionResponseMapper.toResponse(osVersionDeviceCounts, null, null, LATEST_BUILD, TODAY, "cursor-1");

        // verifications
        assertThat(response.getCurrentBuild()).isEqualTo("26100.9974");
        assertThat(response.getDevicesBehindCount()).isEqualTo(5);
        assertThat(response.getEndOfSupportAt()).isNull();
        assertThat(response.getEnterpriseEndOfSupportAt()).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "26100.9973, 1", "26100.999, 1", "26099.99999, 1", "26100, 1",
            "26100.9974, 0", "26100.9975, 0", "26100.10000, 0", "26200.1, 0"})
    void toResponse_buildAgainstTheLatestBuild_behindOnlyWhenNumericallyBelow(String osBuild, int expectedBehind) {
        // setup
        OsVersionDeviceCounts oneBuild =
                new OsVersionDeviceCounts("11 24H2", List.of(new OsVersionBuildCount(osBuild, 1)));

        // execution
        OsVersionResponse response =
                osVersionResponseMapper.toResponse(oneBuild, HOME_AND_PRO, ENTERPRISE, LATEST_BUILD, TODAY, "c");

        // verifications
        assertThat(response.getDevicesBehindCount()).isEqualTo(expectedBehind);
    }

    @Test
    void toDeviceResponse_stateWithAReleaseAndALatestBuild_everyField() {
        // setup
        DeviceOsState deviceOsState = state("26100.4061");

        // execution
        OsVersionDeviceResponse response =
                osVersionResponseMapper.toDeviceResponse(deviceOsState, ENTERPRISE, LATEST_BUILD, TODAY, "cursor-1");

        // verifications
        assertThat(response).isEqualTo(OsVersionDeviceResponse.builder()
                .machineId("machine-1")
                .osBuild("26100.4061")
                .osProductName("Windows 11 Enterprise")
                .upToDate(false)
                .endOfSupportAt(LocalDate.parse("2027-10-12"))
                .supportEnded(false)
                .cursor("cursor-1")
                .build());
    }

    @ParameterizedTest
    @CsvSource({"26100.9974, true", "26100.10075, true", "26200.1, true", "26100.9973, false", "22631.99999, false"})
    void toDeviceResponse_buildAgainstTheLatestBuild_upToDateFromTheLatestBuildUp(String osBuild, boolean expected) {
        // setup

        // execution
        OsVersionDeviceResponse response =
                osVersionResponseMapper.toDeviceResponse(state(osBuild), HOME_AND_PRO, LATEST_BUILD, TODAY, "c");

        // verifications
        assertThat(response.getUpToDate()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(value = {"26100.4061, NULL", "NULL, 26100.9974", "'', 26100.9974"}, nullValues = "NULL")
    void toDeviceResponse_noLatestBuildOrNoBuildOfTheDevice_noFlag(String osBuild, String latestBuild) {
        // setup

        // execution
        OsVersionDeviceResponse response =
                osVersionResponseMapper.toDeviceResponse(state(osBuild), HOME_AND_PRO, latestBuild, TODAY, "c");

        // verifications
        assertThat(response.getUpToDate()).isNull();
        assertThat(response.getSupportEnded()).isTrue();
    }

    @Test
    void toDeviceResponse_noRelease_noEndOfSupport() {
        // setup

        // execution
        OsVersionDeviceResponse response =
                osVersionResponseMapper.toDeviceResponse(state("26100.9974"), null, LATEST_BUILD, TODAY, "c");

        // verifications
        assertThat(response.getUpToDate()).isTrue();
        assertThat(response.getEndOfSupportAt()).isNull();
        assertThat(response.getSupportEnded()).isNull();
    }

    private static DeviceOsState state(String osBuild) {
        return DeviceOsState.builder()
                .machineId("machine-1").osBuild(osBuild).osProductName("Windows 11 Enterprise").build();
    }
}
