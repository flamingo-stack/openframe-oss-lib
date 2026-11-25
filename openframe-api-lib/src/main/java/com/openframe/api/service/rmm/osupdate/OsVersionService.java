package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.OsVersionResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.api.service.rmm.osupdate.release.WindowsEditionGroup;
import com.openframe.api.service.rmm.osupdate.release.WindowsEditionGroupResolver;
import com.openframe.api.service.rmm.osupdate.release.WindowsRelease;
import com.openframe.api.service.rmm.osupdate.release.WindowsReleaseClient;
import com.openframe.api.service.rmm.osupdate.release.WindowsReleaseMatcher;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsVersionBuild;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildRepository;
import com.openframe.data.repository.rmm.osupdate.OsVersionDeviceCounts;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;

// Windows only. Deleted devices have no OS state: their removal deletes it.
@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsVersionService {

    private static final String FIRST_MACHINE_ID = "";

    private final DeviceOsStateRepository deviceOsStateRepository;
    // Written by the enrichment of the management service; empty while that is off: no build fields then.
    private final OsVersionBuildRepository osVersionBuildRepository;
    private final DeviceService deviceService;
    // Absent while openframe.rmm.os-update.os-versions.enabled is off: no end of support then.
    private final ObjectProvider<WindowsReleaseClient> windowsReleaseClient;
    private final WindowsReleaseMatcher windowsReleaseMatcher;
    private final WindowsEditionGroupResolver windowsEditionGroupResolver;
    private final CursorPageAssembler cursorPageAssembler;
    private final OsVersionResponseMapper osVersionResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // Highest OS version first. Organizations: only their devices are counted. Empty = every organization.
    public GenericQueryResult<OsVersionResponse> listOsVersions(List<String> organizationIds,
                                                                CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        String tenantId = tenantIdProvider.getTenantId();
        List<String> scopeMachineIds = findScopeMachineIds(organizationIds);
        List<OsVersionDeviceCounts> fetchedOsVersions = deviceOsStateRepository.findOsVersionPage(
                OsPlatform.WINDOWS, scopeMachineIds, normalizedPagination.getCursor(),
                normalizedPagination.getLimit() + 1, tenantId);
        List<WindowsRelease> windowsReleases = listWindowsReleases();
        Map<String, String> latestBuildsByOsVersion = findLatestBuildsByOsVersion(tenantId);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return cursorPageAssembler.toPage(fetchedOsVersions, normalizedPagination,
                osVersionDeviceCounts -> toResponse(osVersionDeviceCounts, windowsReleases,
                        latestBuildsByOsVersion.get(osVersionDeviceCounts.getOsVersion()), today),
                OsVersionResponse::getCursor);
    }

    // Lowest machine id first. Organizations: only their devices. Empty = every organization.
    public GenericQueryResult<OsVersionDeviceResponse> listOsVersionDevices(String osVersion,
                                                                            List<String> organizationIds,
                                                                            CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        String tenantId = tenantIdProvider.getTenantId();
        String afterMachineId = Objects.requireNonNullElse(normalizedPagination.getCursor(), FIRST_MACHINE_ID);
        Limit limit = Limit.of(normalizedPagination.getLimit() + 1);
        List<String> scopeMachineIds = findScopeMachineIds(organizationIds);
        List<DeviceOsState> fetchedDevices = scopeMachineIds == null
                ? deviceOsStateRepository.findOsVersionDevicePage(
                        tenantId, OsPlatform.WINDOWS, osVersion, afterMachineId, limit)
                : deviceOsStateRepository.findOsVersionDevicePageOnMachines(
                        tenantId, OsPlatform.WINDOWS, osVersion, afterMachineId, scopeMachineIds, limit);
        List<WindowsRelease> windowsReleases = listWindowsReleases();
        String latestBuild = findLatestBuildsByOsVersion(tenantId).get(osVersion);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return cursorPageAssembler.toPage(fetchedDevices, normalizedPagination,
                deviceOsState -> toDeviceResponse(deviceOsState, osVersion, windowsReleases, latestBuild, today),
                OsVersionDeviceResponse::getCursor);
    }

    // The end of support of a device is the one of its edition group.
    private OsVersionDeviceResponse toDeviceResponse(DeviceOsState deviceOsState, String osVersion,
                                                     List<WindowsRelease> windowsReleases, String latestBuild,
                                                     LocalDate today) {
        WindowsEditionGroup windowsEditionGroup =
                windowsEditionGroupResolver.resolve(deviceOsState.getOsProductName());
        WindowsRelease windowsRelease =
                windowsReleaseMatcher.findWindowsRelease(windowsReleases, osVersion, windowsEditionGroup);
        String cursor = CursorCodec.encode(deviceOsState.getMachineId());
        return osVersionResponseMapper.toDeviceResponse(deviceOsState, windowsRelease, latestBuild, today, cursor);
    }

    private OsVersionResponse toResponse(OsVersionDeviceCounts osVersionDeviceCounts,
                                         List<WindowsRelease> windowsReleases, String latestBuild,
                                         LocalDate today) {
        String osVersion = osVersionDeviceCounts.getOsVersion();
        WindowsRelease homeAndProWindowsRelease = windowsReleaseMatcher
                .findWindowsRelease(windowsReleases, osVersion, WindowsEditionGroup.HOME_AND_PRO);
        WindowsRelease enterpriseWindowsRelease = windowsReleaseMatcher
                .findWindowsRelease(windowsReleases, osVersion, WindowsEditionGroup.ENTERPRISE_AND_EDUCATION);
        String cursor = CursorCodec.encode(osVersion);
        return osVersionResponseMapper.toResponse(osVersionDeviceCounts, homeAndProWindowsRelease,
                enterpriseWindowsRelease, latestBuild, today, cursor);
    }

    // One query: the collection has one entry per Windows version the vendor's bulletins name.
    private Map<String, String> findLatestBuildsByOsVersion(String tenantId) {
        return osVersionBuildRepository.findByTenantIdAndPlatform(tenantId, OsPlatform.WINDOWS).stream()
                .collect(Collectors.toMap(OsVersionBuild::getOsVersion, OsVersionBuild::getLatestBuild,
                        (first, second) -> first));
    }

    private List<WindowsRelease> listWindowsReleases() {
        WindowsReleaseClient availableWindowsReleaseClient = windowsReleaseClient.getIfAvailable();
        return availableWindowsReleaseClient == null ? List.of() : availableWindowsReleaseClient.listWindowsReleases();
    }

    private List<String> findScopeMachineIds(List<String> organizationIds) {
        return isEmpty(organizationIds) ? null : deviceService.findDeviceIdsOfOrganizations(organizationIds);
    }
}
