package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.service.rmm.osupdate.release.WindowsRelease;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildCount;
import com.openframe.data.repository.rmm.osupdate.OsVersionDeviceCounts;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class OsVersionResponseMapper {

    // A release is null when endoflife has no row of the edition group for the version. latestBuild is the stored
    // latest security build with its revision, null when none is stored: no devices behind then, and the current
    // build falls back to the base build of the release.
    public OsVersionResponse toResponse(OsVersionDeviceCounts osVersionDeviceCounts,
                                        WindowsRelease homeAndProWindowsRelease,
                                        WindowsRelease enterpriseWindowsRelease,
                                        String latestBuild, LocalDate today, String cursor) {
        List<OsVersionBuildCount> osVersionBuildCounts = osVersionDeviceCounts.getOsVersionBuildCounts();
        long deviceCount = osVersionBuildCounts.stream()
                .mapToLong(OsVersionBuildCount::getDeviceCount)
                .sum();
        LocalDate endOfSupportAt = toEndOfSupportAt(homeAndProWindowsRelease);
        LocalDate enterpriseEndOfSupportAt = toEndOfSupportAt(enterpriseWindowsRelease);
        return OsVersionResponse.builder()
                .osVersion(osVersionDeviceCounts.getOsVersion())
                .deviceCount(Math.toIntExact(deviceCount))
                .devicesBehindCount(toDevicesBehindCount(osVersionBuildCounts, latestBuild))
                .currentBuild(toCurrentBuild(latestBuild, homeAndProWindowsRelease, enterpriseWindowsRelease))
                .endOfSupportAt(endOfSupportAt)
                .supportEnded(toSupportEnded(endOfSupportAt, today))
                .enterpriseEndOfSupportAt(enterpriseEndOfSupportAt)
                .enterpriseSupportEnded(toSupportEnded(enterpriseEndOfSupportAt, today))
                .cursor(cursor)
                .build();
    }

    // windowsRelease is the row of the edition group of the device.
    public OsVersionDeviceResponse toDeviceResponse(DeviceOsState deviceOsState, WindowsRelease windowsRelease,
                                                    String latestBuild, LocalDate today, String cursor) {
        LocalDate endOfSupportAt = toEndOfSupportAt(windowsRelease);
        return OsVersionDeviceResponse.builder()
                .machineId(deviceOsState.getMachineId())
                .osBuild(deviceOsState.getOsBuild())
                .osProductName(deviceOsState.getOsProductName())
                .upToDate(toUpToDate(deviceOsState.getOsBuild(), latestBuild))
                .endOfSupportAt(endOfSupportAt)
                .supportEnded(toSupportEnded(endOfSupportAt, today))
                .cursor(cursor)
                .build();
    }

    // A device without a reported build is not counted: it is not known to be behind.
    private static Integer toDevicesBehindCount(List<OsVersionBuildCount> osVersionBuildCounts, String latestBuild) {
        if (latestBuild == null) {
            return null;
        }
        long devicesBehindCount = osVersionBuildCounts.stream()
                .filter(osVersionBuildCount -> Boolean.FALSE.equals(
                        toUpToDate(osVersionBuildCount.getOsBuild(), latestBuild)))
                .mapToLong(OsVersionBuildCount::getDeviceCount)
                .sum();
        return Math.toIntExact(devicesBehindCount);
    }

    // A build above the latest security build (a preview) is up to date.
    private static Boolean toUpToDate(String osBuild, String latestBuild) {
        if (latestBuild == null || isBlank(osBuild)) {
            return null;
        }
        return SoftwareVersions.compare(osBuild, latestBuild) >= 0;
    }

    private static String toCurrentBuild(String latestBuild, WindowsRelease homeAndProWindowsRelease,
                                         WindowsRelease enterpriseWindowsRelease) {
        if (latestBuild != null) {
            return latestBuild;
        }
        if (homeAndProWindowsRelease != null) {
            return homeAndProWindowsRelease.getLatestBuild();
        }
        return enterpriseWindowsRelease == null ? null : enterpriseWindowsRelease.getLatestBuild();
    }

    private static LocalDate toEndOfSupportAt(WindowsRelease windowsRelease) {
        return windowsRelease == null ? null : windowsRelease.getEndOfSupportAt();
    }

    private static Boolean toSupportEnded(LocalDate endOfSupportAt, LocalDate today) {
        return endOfSupportAt == null ? null : endOfSupportAt.isBefore(today);
    }
}
