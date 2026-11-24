package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.InstalledOsUpdateDevice;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateQueryService {

    private final OsUpdateRepository osUpdateRepository;
    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final OsUpdateResponseMapper osUpdateResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    public GenericQueryResult<OsUpdateResponse> listOsUpdates(OsUpdateFilter osUpdateFilter,
                                                              CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        int limit = normalizedPagination.getLimit();

        // one update over the limit tells whether a next page exists
        List<OsUpdate> fetchedOsUpdates = osUpdateRepository.findPage(
                tenantIdProvider.getTenantId(), osUpdateFilter, normalizedPagination.getCursor(), limit + 1);
        List<OsUpdateResponse> pageOsUpdates = fetchedOsUpdates.stream()
                .limit(limit)
                .map(this::toResponse)
                .toList();
        boolean hasNextPage = fetchedOsUpdates.size() > limit;
        return toQueryResult(pageOsUpdates, OsUpdateResponse::getCursor, hasNextPage, normalizedPagination);
    }

    public Optional<OsUpdateResponse> findOsUpdate(String osUpdateId) {
        Optional<OsUpdate> osUpdate = osUpdateRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), osUpdateId);
        return osUpdate.map(this::toResponse);
    }

    // Pending: devices that list the update now, without the devices we cannot manage. Installed: devices whose
    // stored history has a successful install of it. Only Windows reports a history.
    public Map<String, OsUpdateDeviceCounts> countDevices(Collection<String> osUpdateIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<OsUpdate> osUpdates = osUpdateRepository.findByTenantIdAndIdIn(tenantId, osUpdateIds);
        if (osUpdates.isEmpty()) {
            return Map.of();
        }
        List<String> notManageableMachineIds = findNotManageableMachineIds();
        Map<OsPlatform, List<OsUpdate>> osUpdatesByPlatform = osUpdates.stream()
                .collect(Collectors.groupingBy(OsUpdate::getPlatform));
        Map<String, OsUpdateDeviceCounts> deviceCountsByOsUpdateId = new HashMap<>();
        osUpdatesByPlatform.forEach((platform, platformOsUpdates) -> deviceCountsByOsUpdateId.putAll(
                countDevicesOfPlatform(platform, platformOsUpdates, notManageableMachineIds)));
        return deviceCountsByOsUpdateId;
    }

    // Each status reads its own collection, so a page never mixes the two.
    public GenericQueryResult<OsUpdateDeviceResponse> listDevices(String osUpdateId, OsUpdateDeviceStatus status,
                                                                  CursorPaginationCriteria pagination) {
        OsUpdate osUpdate = getOsUpdate(osUpdateId);
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        int limit = normalizedPagination.getLimit();

        // one device over the limit tells whether a next page exists
        List<OsUpdateDeviceResponse> fetchedDevices = status == OsUpdateDeviceStatus.PENDING
                ? findPendingDevices(osUpdate, normalizedPagination.getCursor(), limit + 1)
                : findInstalledDevices(osUpdate, normalizedPagination.getCursor(), limit + 1);
        List<OsUpdateDeviceResponse> pageDevices = fetchedDevices.stream()
                .limit(limit)
                .toList();
        boolean hasNextPage = fetchedDevices.size() > limit;
        return toQueryResult(pageDevices, OsUpdateDeviceResponse::getCursor, hasNextPage, normalizedPagination);
    }

    private OsUpdate getOsUpdate(String osUpdateId) {
        Optional<OsUpdate> osUpdate = osUpdateRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), osUpdateId);
        return osUpdate.orElseThrow(() -> new OsUpdateNotFoundException("OS update not found: " + osUpdateId));
    }

    private List<String> findNotManageableMachineIds() {
        return deviceOsStateRepository.findMachineIds(
                tenantIdProvider.getTenantId(), OsUpdateManageabilityState.NOT_MANAGEABLE);
    }

    // An identifier names one update within one platform.
    private Map<String, OsUpdateDeviceCounts> countDevicesOfPlatform(OsPlatform platform, List<OsUpdate> osUpdates,
                                                                     List<String> notManageableMachineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> identifiers = osUpdates.stream()
                .map(OsUpdate::getIdentifier)
                .toList();
        List<OsUpdateDeviceCount> pendingDeviceCounts = deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                tenantId, platform, identifiers, notManageableMachineIds);
        List<OsUpdateDeviceCount> installedDeviceCounts = platform == OsPlatform.WINDOWS
                ? deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(tenantId, identifiers)
                : List.of();
        Map<String, Integer> pendingByIdentifier = toCountByIdentifier(pendingDeviceCounts);
        Map<String, Integer> installedByIdentifier = toCountByIdentifier(installedDeviceCounts);
        return osUpdates.stream()
                .collect(Collectors.toMap(OsUpdate::getId, osUpdate -> OsUpdateDeviceCounts.builder()
                        .pendingDeviceCount(pendingByIdentifier.getOrDefault(osUpdate.getIdentifier(), 0))
                        .installedDeviceCount(installedByIdentifier.getOrDefault(osUpdate.getIdentifier(), 0))
                        .build()));
    }

    private static Map<String, Integer> toCountByIdentifier(List<OsUpdateDeviceCount> deviceCounts) {
        return deviceCounts.stream()
                .collect(Collectors.toMap(
                        OsUpdateDeviceCount::getIdentifier,
                        deviceCount -> Math.toIntExact(deviceCount.getDeviceCount())));
    }

    private List<OsUpdateDeviceResponse> findPendingDevices(OsUpdate osUpdate, String cursor, int limit) {
        List<String> notManageableMachineIds = findNotManageableMachineIds();
        List<DeviceOsPendingUpdate> pendingUpdates = deviceOsPendingUpdateRepository.findDevicePage(
                tenantIdProvider.getTenantId(), osUpdate.getPlatform(), osUpdate.getIdentifier(),
                notManageableMachineIds, cursor, limit);
        return pendingUpdates.stream()
                .map(this::toPendingDeviceResponse)
                .toList();
    }

    private List<OsUpdateDeviceResponse> findInstalledDevices(OsUpdate osUpdate, String cursor, int limit) {
        if (osUpdate.getPlatform() != OsPlatform.WINDOWS) {
            return List.of();
        }
        List<InstalledOsUpdateDevice> installedDevices = deviceOsUpdateHistoryRepository.findInstalledDevicePage(
                tenantIdProvider.getTenantId(), osUpdate.getIdentifier(), cursor, limit);
        return installedDevices.stream()
                .map(this::toInstalledDeviceResponse)
                .toList();
    }

    private OsUpdateResponse toResponse(OsUpdate osUpdate) {
        String rawCursor = osUpdateRepository.encodeCursor(osUpdate);
        return osUpdateResponseMapper.toResponse(osUpdate, CursorCodec.encode(rawCursor));
    }

    private OsUpdateDeviceResponse toPendingDeviceResponse(DeviceOsPendingUpdate pendingUpdate) {
        String rawCursor = deviceOsPendingUpdateRepository.encodeDeviceCursor(pendingUpdate);
        return osUpdateResponseMapper.toPendingDeviceResponse(pendingUpdate, CursorCodec.encode(rawCursor));
    }

    private OsUpdateDeviceResponse toInstalledDeviceResponse(InstalledOsUpdateDevice installedDevice) {
        String rawCursor = deviceOsUpdateHistoryRepository.encodeInstalledDeviceCursor(installedDevice);
        return osUpdateResponseMapper.toInstalledDeviceResponse(installedDevice, CursorCodec.encode(rawCursor));
    }

    private static <T> GenericQueryResult<T> toQueryResult(List<T> pageItems, Function<T, String> cursorOf,
                                                           boolean hasNextPage,
                                                           CursorPaginationCriteria normalizedPagination) {
        String startCursor = pageItems.isEmpty() ? null : cursorOf.apply(pageItems.getFirst());
        String endCursor = pageItems.isEmpty() ? null : cursorOf.apply(pageItems.getLast());
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(normalizedPagination.hasCursor())
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
        return GenericQueryResult.<T>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .build();
    }
}
