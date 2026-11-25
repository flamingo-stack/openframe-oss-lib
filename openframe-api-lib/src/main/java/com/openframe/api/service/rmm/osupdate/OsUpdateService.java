package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;

// WARNING: client-core has an OsUpdateService bean too; the name keeps both in one context
@Service("apiOsUpdateService")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateService {

    private final OsUpdateRepository osUpdateRepository;
    private final DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    private final DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    private final DeviceService deviceService;
    private final CursorPageAssembler cursorPageAssembler;
    private final OsUpdateResponseMapper osUpdateResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // Organizations: only the updates pending on or installed by their devices. Empty = every organization.
    public GenericQueryResult<OsUpdateResponse> listOsUpdates(OsUpdateFilter osUpdateFilter,
                                                              List<String> organizationIds,
                                                              CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        OsUpdateFilter scopedOsUpdateFilter = isEmpty(organizationIds)
                ? osUpdateFilter
                : osUpdateFilter.toBuilder().osUpdateIds(findOsUpdateIdsOfOrganizations(organizationIds)).build();
        List<OsUpdate> fetchedOsUpdates = osUpdateRepository.findPage(tenantIdProvider.getTenantId(),
                scopedOsUpdateFilter, normalizedPagination.getCursor(), normalizedPagination.getLimit() + 1);
        return cursorPageAssembler.toPage(
                fetchedOsUpdates, normalizedPagination, this::toResponse, OsUpdateResponse::getCursor);
    }

    public Optional<OsUpdateResponse> findOsUpdate(String osUpdateId) {
        Optional<OsUpdate> osUpdate = osUpdateRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), osUpdateId);
        return osUpdate.map(this::toResponse);
    }

    public OsUpdate getOsUpdate(String osUpdateId) {
        Optional<OsUpdate> osUpdate = osUpdateRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), osUpdateId);
        return osUpdate.orElseThrow(() -> new OsUpdateNotFoundException("OS update not found: " + osUpdateId));
    }

    // Pending: devices that list the update now, without the devices we cannot manage. Installed: devices whose
    // stored history has a successful install of it. Only Windows reports a history. Organizations: only their
    // devices are counted. Empty = every organization.
    public Map<String, OsUpdateDeviceCounts> countDevices(Collection<String> osUpdateIds,
                                                          List<String> organizationIds) {
        List<OsUpdate> osUpdates = osUpdateRepository.findByTenantIdAndIdIn(tenantIdProvider.getTenantId(), osUpdateIds);
        if (osUpdates.isEmpty()) {
            return Map.of();
        }
        List<String> scopeMachineIds = isEmpty(organizationIds)
                ? null
                : deviceService.findDeviceIdsOfOrganizations(organizationIds);
        Map<OsPlatform, List<OsUpdate>> osUpdatesByPlatform = osUpdates.stream()
                .collect(Collectors.groupingBy(OsUpdate::getPlatform));
        Map<String, OsUpdateDeviceCounts> deviceCountsByOsUpdateId = new HashMap<>();
        osUpdatesByPlatform.forEach((platform, platformOsUpdates) -> deviceCountsByOsUpdateId.putAll(
                countDevicesOfPlatform(platform, platformOsUpdates, scopeMachineIds)));
        return deviceCountsByOsUpdateId;
    }

    // An identifier names one update within one platform; only Windows reports a history.
    private List<String> findOsUpdateIdsOfOrganizations(List<String> organizationIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> machineIds = deviceService.findDeviceIdsOfOrganizations(organizationIds);
        Map<OsPlatform, Set<String>> identifiersByPlatform = new EnumMap<>(OsPlatform.class);
        deviceOsPendingUpdateService.listIdentifiersByPlatform(machineIds)
                .forEach(identifiersOfPlatform -> identifiersByPlatform
                        .computeIfAbsent(identifiersOfPlatform.getPlatform(), platform -> new HashSet<>())
                        .addAll(identifiersOfPlatform.getIdentifiers()));
        List<String> installedIdentifiers = deviceOsUpdateHistoryService.listInstalledIdentifiers(machineIds);
        if (!installedIdentifiers.isEmpty()) {
            identifiersByPlatform.computeIfAbsent(OsPlatform.WINDOWS, platform -> new HashSet<>())
                    .addAll(installedIdentifiers);
        }
        return identifiersByPlatform.entrySet().stream()
                .flatMap(platformIdentifiers -> osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                        tenantId, platformIdentifiers.getKey(), platformIdentifiers.getValue()).stream())
                .map(OsUpdate::getId)
                .toList();
    }

    // An identifier names one update within one platform.
    private Map<String, OsUpdateDeviceCounts> countDevicesOfPlatform(OsPlatform platform, List<OsUpdate> osUpdates,
                                                                     List<String> scopeMachineIds) {
        List<String> identifiers = osUpdates.stream()
                .map(OsUpdate::getIdentifier)
                .toList();
        List<OsUpdateDeviceCount> pendingDeviceCounts =
                deviceOsPendingUpdateService.countDevicesByIdentifier(platform, identifiers, scopeMachineIds);
        List<OsUpdateDeviceCount> installedDeviceCounts = platform == OsPlatform.WINDOWS
                ? deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(identifiers, scopeMachineIds)
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

    private OsUpdateResponse toResponse(OsUpdate osUpdate) {
        String rawCursor = osUpdateRepository.encodeCursor(osUpdate);
        return osUpdateResponseMapper.toResponse(osUpdate, CursorCodec.encode(rawCursor));
    }
}
