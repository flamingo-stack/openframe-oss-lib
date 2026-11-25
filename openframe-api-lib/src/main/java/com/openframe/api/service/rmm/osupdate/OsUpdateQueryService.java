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
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.device.MachineRepository;
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
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateQueryService {

    private final OsUpdateRepository osUpdateRepository;
    private final MachineRepository machineRepository;
    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final OsUpdateResponseMapper osUpdateResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // Organizations: only the updates pending on or installed by their devices. Empty = every organization.
    public GenericQueryResult<OsUpdateResponse> listOsUpdates(OsUpdateFilter osUpdateFilter,
                                                              List<String> organizationIds,
                                                              CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        int limit = normalizedPagination.getLimit();
        OsUpdateFilter scopedOsUpdateFilter = isEmpty(organizationIds)
                ? osUpdateFilter
                : osUpdateFilter.toBuilder().osUpdateIds(findOsUpdateIdsOfOrganizations(organizationIds)).build();

        // one update over the limit tells whether a next page exists
        List<OsUpdate> fetchedOsUpdates = osUpdateRepository.findPage(
                tenantIdProvider.getTenantId(), scopedOsUpdateFilter, normalizedPagination.getCursor(), limit + 1);
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
    // stored history has a successful install of it. Only Windows reports a history. Organizations: only their
    // devices are counted. Empty = every organization.
    public Map<String, OsUpdateDeviceCounts> countDevices(Collection<String> osUpdateIds,
                                                          List<String> organizationIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<OsUpdate> osUpdates = osUpdateRepository.findByTenantIdAndIdIn(tenantId, osUpdateIds);
        if (osUpdates.isEmpty()) {
            return Map.of();
        }
        List<String> notManageableMachineIds = findNotManageableMachineIds();
        List<String> scopeMachineIds = findScopeMachineIds(organizationIds);
        Map<OsPlatform, List<OsUpdate>> osUpdatesByPlatform = osUpdates.stream()
                .collect(Collectors.groupingBy(OsUpdate::getPlatform));
        Map<String, OsUpdateDeviceCounts> deviceCountsByOsUpdateId = new HashMap<>();
        osUpdatesByPlatform.forEach((platform, platformOsUpdates) -> deviceCountsByOsUpdateId.putAll(
                countDevicesOfPlatform(platform, platformOsUpdates, notManageableMachineIds, scopeMachineIds)));
        return deviceCountsByOsUpdateId;
    }

    // Each status reads its own collection, so a page never mixes the two.
    public GenericQueryResult<OsUpdateDeviceResponse> listDevices(String osUpdateId, OsUpdateDeviceStatus status,
                                                                  List<String> organizationIds,
                                                                  CursorPaginationCriteria pagination) {
        OsUpdate osUpdate = getOsUpdate(osUpdateId);
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        int limit = normalizedPagination.getLimit();
        List<String> scopeMachineIds = findScopeMachineIds(organizationIds);

        // one device over the limit tells whether a next page exists
        List<OsUpdateDeviceResponse> fetchedDevices = status == OsUpdateDeviceStatus.PENDING
                ? findPendingDevices(osUpdate, scopeMachineIds, normalizedPagination.getCursor(), limit + 1)
                : findInstalledDevices(osUpdate, scopeMachineIds, normalizedPagination.getCursor(), limit + 1);
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
        List<DeviceOsState> notManageableStates = deviceOsStateRepository.findByTenantIdAndManageabilityState(
                tenantIdProvider.getTenantId(), OsUpdateManageabilityState.NOT_MANAGEABLE);
        return notManageableStates.stream()
                .map(DeviceOsState::getMachineId)
                .toList();
    }

    // Null = every device of the tenant.
    private List<String> findScopeMachineIds(List<String> organizationIds) {
        if (isEmpty(organizationIds)) {
            return null;
        }
        MachineQueryFilter machineQueryFilter = new MachineQueryFilter();
        machineQueryFilter.setOrganizationIds(organizationIds);
        return machineRepository.findMachineIdsByCriteria(tenantIdProvider.getTenantId(), machineQueryFilter, null);
    }

    // An identifier names one update within one platform; only Windows reports a history.
    private List<String> findOsUpdateIdsOfOrganizations(List<String> organizationIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> scopeMachineIds = findScopeMachineIds(organizationIds);
        Map<OsPlatform, Set<String>> identifiersByPlatform = new EnumMap<>(OsPlatform.class);
        deviceOsPendingUpdateRepository.findIdentifiersByPlatformOnMachines(tenantId, scopeMachineIds)
                .forEach(identifiersOfPlatform -> identifiersByPlatform
                        .computeIfAbsent(identifiersOfPlatform.getPlatform(), platform -> new HashSet<>())
                        .addAll(identifiersOfPlatform.getIdentifiers()));
        List<String> installedIdentifiers =
                deviceOsUpdateHistoryRepository.findInstalledIdentifiersOnMachines(tenantId, scopeMachineIds);
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
                                                                     List<String> notManageableMachineIds,
                                                                     List<String> scopeMachineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> identifiers = osUpdates.stream()
                .map(OsUpdate::getIdentifier)
                .toList();
        List<OsUpdateDeviceCount> pendingDeviceCounts = scopeMachineIds == null
                ? deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                        tenantId, platform, identifiers, notManageableMachineIds)
                : deviceOsPendingUpdateRepository.countDevicesByIdentifierOnMachines(
                        tenantId, platform, identifiers, withoutMachines(scopeMachineIds, notManageableMachineIds));
        List<OsUpdateDeviceCount> installedDeviceCounts = platform == OsPlatform.WINDOWS
                ? countInstalledDevices(tenantId, identifiers, scopeMachineIds)
                : List.of();
        Map<String, Integer> pendingByIdentifier = toCountByIdentifier(pendingDeviceCounts);
        Map<String, Integer> installedByIdentifier = toCountByIdentifier(installedDeviceCounts);
        return osUpdates.stream()
                .collect(Collectors.toMap(OsUpdate::getId, osUpdate -> OsUpdateDeviceCounts.builder()
                        .pendingDeviceCount(pendingByIdentifier.getOrDefault(osUpdate.getIdentifier(), 0))
                        .installedDeviceCount(installedByIdentifier.getOrDefault(osUpdate.getIdentifier(), 0))
                        .build()));
    }

    private List<OsUpdateDeviceCount> countInstalledDevices(String tenantId, List<String> identifiers,
                                                            List<String> scopeMachineIds) {
        return scopeMachineIds == null
                ? deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(tenantId, identifiers)
                : deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifierOnMachines(
                        tenantId, identifiers, scopeMachineIds);
    }

    private static List<String> withoutMachines(List<String> machineIds, List<String> excludedMachineIds) {
        Set<String> excluded = new HashSet<>(excludedMachineIds);
        return machineIds.stream()
                .filter(machineId -> !excluded.contains(machineId))
                .toList();
    }

    private static Map<String, Integer> toCountByIdentifier(List<OsUpdateDeviceCount> deviceCounts) {
        return deviceCounts.stream()
                .collect(Collectors.toMap(
                        OsUpdateDeviceCount::getIdentifier,
                        deviceCount -> Math.toIntExact(deviceCount.getDeviceCount())));
    }

    private List<OsUpdateDeviceResponse> findPendingDevices(OsUpdate osUpdate, List<String> scopeMachineIds,
                                                            String cursor, int limit) {
        List<String> notManageableMachineIds = findNotManageableMachineIds();
        List<DeviceOsPendingUpdate> pendingUpdates = deviceOsPendingUpdateRepository.findDevicePage(
                tenantIdProvider.getTenantId(), osUpdate.getPlatform(), osUpdate.getIdentifier(),
                notManageableMachineIds, scopeMachineIds, cursor, limit);
        return pendingUpdates.stream()
                .map(this::toPendingDeviceResponse)
                .toList();
    }

    private List<OsUpdateDeviceResponse> findInstalledDevices(OsUpdate osUpdate, List<String> scopeMachineIds,
                                                              String cursor, int limit) {
        if (osUpdate.getPlatform() != OsPlatform.WINDOWS) {
            return List.of();
        }
        List<InstalledOsUpdateDevice> installedDevices = deviceOsUpdateHistoryRepository.findInstalledDevicePage(
                tenantIdProvider.getTenantId(), osUpdate.getIdentifier(), scopeMachineIds, cursor, limit);
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
