package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.service.rmm.osupdate.release.WindowsRelease;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildCount;
import com.openframe.data.repository.rmm.osupdate.OsVersionDeviceCounts;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class OsVersionResponseMapper {

    // windowsRelease null = no reference data for the version.
    public OsVersionResponse toResponse(OsVersionDeviceCounts osVersionDeviceCounts,
                                        WindowsRelease windowsRelease, Integer devicesBehindCount,
                                        LocalDate today, String cursor) {
        long deviceCount = osVersionDeviceCounts.getOsVersionBuildCounts().stream()
                .mapToLong(OsVersionBuildCount::getDeviceCount)
                .sum();
        LocalDate endOfSupportAt = windowsRelease == null ? null : windowsRelease.getEndOfSupportAt();
        return OsVersionResponse.builder()
                .osVersion(osVersionDeviceCounts.getOsVersion())
                .deviceCount(Math.toIntExact(deviceCount))
                .devicesBehindCount(devicesBehindCount)
                .currentBuild(windowsRelease == null ? null : windowsRelease.getLatestBuild())
                .endOfSupportAt(endOfSupportAt)
                .supportEnded(endOfSupportAt == null ? null : endOfSupportAt.isBefore(today))
                .cursor(cursor)
                .build();
    }

    public OsVersionDeviceResponse toDeviceResponse(DeviceOsState deviceOsState, Boolean upToDate, String cursor) {
        return OsVersionDeviceResponse.builder()
                .machineId(deviceOsState.getMachineId())
                .osBuild(deviceOsState.getOsBuild())
                .osProductName(deviceOsState.getOsProductName())
                .upToDate(upToDate)
                .cursor(cursor)
                .build();
    }
}
