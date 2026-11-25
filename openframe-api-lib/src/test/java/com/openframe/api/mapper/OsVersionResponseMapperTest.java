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

    private final OsVersionResponseMapper osVersionResponseMapper = new OsVersionResponseMapper();

    private final OsVersionDeviceCounts osVersionDeviceCounts = new OsVersionDeviceCounts("11 24H2", List.of(
            new OsVersionBuildCount("26100.4061", 2), new OsVersionBuildCount("22631.1", 3)));

    @Test
    void toResponse_withRelease_everyField() {
        // setup
        WindowsRelease windowsRelease = WindowsRelease.builder()
                .cycle("11-24h2-w").latestBuild("26100").endOfSupportAt(LocalDate.parse("2026-10-13")).build();
        OsVersionResponse expected = OsVersionResponse.builder()
                .osVersion("11 24H2")
                .deviceCount(5)
                .currentBuild("26100")
                .endOfSupportAt(LocalDate.parse("2026-10-13"))
                .supportEnded(true)
                .cursor("cursor-1")
                .build();

        // execution
        OsVersionResponse response =
                osVersionResponseMapper.toResponse(osVersionDeviceCounts, windowsRelease, TODAY, "cursor-1");

        // verifications
        assertThat(response).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"2026-11-24, true", "2026-11-25, false", "2026-11-26, false"})
    void toResponse_endOfSupport_endedOnlyAfterTheDay(LocalDate endOfSupportAt, boolean expectedEnded) {
        // setup
        WindowsRelease windowsRelease = WindowsRelease.builder().cycle("c").endOfSupportAt(endOfSupportAt).build();

        // execution
        OsVersionResponse response =
                osVersionResponseMapper.toResponse(osVersionDeviceCounts, windowsRelease, TODAY, "c");

        // verifications
        assertThat(response.getSupportEnded()).isEqualTo(expectedEnded);
    }

    @Test
    void toResponse_noRelease_countsOnlyAndTheReferenceFieldsNull() {
        // setup

        // execution
        OsVersionResponse response =
                osVersionResponseMapper.toResponse(osVersionDeviceCounts, null, TODAY, "cursor-1");

        // verifications
        assertThat(response.getDeviceCount()).isEqualTo(5);
        assertThat(response.getDevicesBehindCount()).isNull();
        assertThat(response.getCurrentBuild()).isNull();
        assertThat(response.getEndOfSupportAt()).isNull();
        assertThat(response.getSupportEnded()).isNull();
    }

    @Test
    void toDeviceResponse_state_machineBuildProductAndNoFlag() {
        // setup
        DeviceOsState deviceOsState = DeviceOsState.builder()
                .machineId("machine-1").osBuild("26100.4061").osProductName("Windows 11 Pro").build();

        // execution
        OsVersionDeviceResponse response = osVersionResponseMapper.toDeviceResponse(deviceOsState, "cursor-1");

        // verifications
        assertThat(response).isEqualTo(OsVersionDeviceResponse.builder()
                .machineId("machine-1").osBuild("26100.4061").osProductName("Windows 11 Pro")
                .cursor("cursor-1").build());
    }
}
