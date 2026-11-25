package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsVersionDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsVersionResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.OsVersionResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.api.service.rmm.osupdate.release.WindowsRelease;
import com.openframe.api.service.rmm.osupdate.release.WindowsReleaseClient;
import com.openframe.api.service.rmm.osupdate.release.WindowsReleaseMatcher;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
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
import java.util.Objects;

import static org.springframework.util.CollectionUtils.isEmpty;

// Windows only. Deleted devices have no OS state: their removal deletes it.
@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsVersionService {

    private static final String FIRST_MACHINE_ID = "";

    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceService deviceService;
    // Absent while openframe.rmm.os-update.os-versions.enabled is off: no reference fields then.
    private final ObjectProvider<WindowsReleaseClient> windowsReleaseClient;
    private final WindowsReleaseMatcher windowsReleaseMatcher;
    private final CursorPageAssembler cursorPageAssembler;
    private final OsVersionResponseMapper osVersionResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // Highest OS version first. Organizations: only their devices are counted. Empty = every organization.
    public GenericQueryResult<OsVersionResponse> listOsVersions(List<String> organizationIds,
                                                                CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        List<String> scopeMachineIds = findScopeMachineIds(organizationIds);
        List<OsVersionDeviceCounts> fetchedOsVersions = deviceOsStateRepository.findOsVersionPage(
                OsPlatform.WINDOWS, scopeMachineIds, normalizedPagination.getCursor(),
                normalizedPagination.getLimit() + 1, tenantIdProvider.getTenantId());
        List<WindowsRelease> windowsReleases = listWindowsReleases();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return cursorPageAssembler.toPage(fetchedOsVersions, normalizedPagination,
                osVersionDeviceCounts -> toResponse(osVersionDeviceCounts, windowsReleases, today),
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
        return cursorPageAssembler.toPage(fetchedDevices, normalizedPagination, this::toDeviceResponse,
                OsVersionDeviceResponse::getCursor);
    }

    private OsVersionDeviceResponse toDeviceResponse(DeviceOsState deviceOsState) {
        String cursor = CursorCodec.encode(deviceOsState.getMachineId());
        return osVersionResponseMapper.toDeviceResponse(deviceOsState, cursor);
    }

    private OsVersionResponse toResponse(OsVersionDeviceCounts osVersionDeviceCounts,
                                         List<WindowsRelease> windowsReleases, LocalDate today) {
        WindowsRelease windowsRelease = windowsReleaseMatcher
                .findWindowsRelease(windowsReleases, osVersionDeviceCounts.getOsVersion());
        String cursor = CursorCodec.encode(osVersionDeviceCounts.getOsVersion());
        return osVersionResponseMapper.toResponse(osVersionDeviceCounts, windowsRelease, today, cursor);
    }

    private List<WindowsRelease> listWindowsReleases() {
        WindowsReleaseClient availableWindowsReleaseClient = windowsReleaseClient.getIfAvailable();
        return availableWindowsReleaseClient == null ? List.of() : availableWindowsReleaseClient.listWindowsReleases();
    }

    private List<String> findScopeMachineIds(List<String> organizationIds) {
        return isEmpty(organizationIds) ? null : deviceService.findDeviceIdsOfOrganizations(organizationIds);
    }
}
