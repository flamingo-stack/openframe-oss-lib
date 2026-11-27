package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateCustomerResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdatePolicyResponseMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOrganizationDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.osupdate.OsUpdateCustomerRollout;
import com.openframe.data.service.rmm.osupdate.OsUpdateCustomerStatusResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;

// WARNING: client-core has an OsUpdateService bean too; the name keeps both in one context
@Service("apiOsUpdateService")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateService {

    // The policies are applied to Windows devices only, so only a Windows update has a status at a customer.
    private static final OsPlatform POLICY_PLATFORM = OsPlatform.WINDOWS;

    private final OsUpdateRepository osUpdateRepository;
    private final DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    private final DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    private final DeviceService deviceService;
    private final CursorPageAssembler cursorPageAssembler;
    private final OsUpdateResponseMapper osUpdateResponseMapper;
    private final TenantIdProvider tenantIdProvider;
    private final OsUpdatePolicyRepository osUpdatePolicyRepository;
    private final OsUpdateOverrideRepository osUpdateOverrideRepository;
    private final OsUpdateCustomerStatusResolver osUpdateCustomerStatusResolver;
    private final OsUpdatePolicyResponseMapper osUpdatePolicyResponseMapper;

    // Empty organizations = every device.
    public OsUpdateDeviceScope findDeviceScope(List<String> organizationIds) {
        return isEmpty(organizationIds)
                ? OsUpdateDeviceScope.EVERY_DEVICE
                : new OsUpdateDeviceScope(deviceService.findDeviceIdsOfOrganizations(organizationIds));
    }

    // A scope of some devices: only the updates pending on or installed by them. Customer statuses: only the
    // updates with one of them at a customer of the scope.
    public GenericQueryResult<OsUpdateResponse> listOsUpdates(OsUpdateFilter osUpdateFilter,
                                                              OsUpdateDeviceScope osUpdateDeviceScope,
                                                              CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        List<String> scopeMachineIds = osUpdateDeviceScope.getMachineIds();
        OsUpdateFilter scopedOsUpdateFilter = osUpdateFilter.toBuilder()
                .osUpdateIds(findOsUpdateIdsOfScope(osUpdateFilter, scopeMachineIds))
                .build();
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

    // The customers that have a device the update is pending on or installed by, in the order of their ids.
    // Empty for a macOS update.
    public List<OsUpdateCustomerResponse> listCustomers(String osUpdateId) {
        OsUpdate osUpdate = getOsUpdate(osUpdateId);
        if (osUpdate.getPlatform() != POLICY_PLATFORM) {
            return List.of();
        }
        List<String> identifiers = List.of(osUpdate.getIdentifier());
        return toCustomers(List.of(osUpdate),
                deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                        POLICY_PLATFORM, identifiers, null),
                deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(identifiers, null));
    }

    // The distinct statuses of each update over the customers of the scope. An update without customers, a macOS
    // one among them, has no entry.
    public Map<String, List<OsUpdateCustomerStatus>> findCustomerStatuses(Collection<String> osUpdateIds,
                                                                          OsUpdateDeviceScope osUpdateDeviceScope) {
        List<OsUpdate> osUpdates = osUpdateRepository
                .findByTenantIdAndIdIn(tenantIdProvider.getTenantId(), osUpdateIds).stream()
                .filter(osUpdate -> osUpdate.getPlatform() == POLICY_PLATFORM)
                .toList();
        if (osUpdates.isEmpty()) {
            return Map.of();
        }
        List<String> identifiers = osUpdates.stream().map(OsUpdate::getIdentifier).toList();
        List<String> scopeMachineIds = osUpdateDeviceScope.getMachineIds();
        List<OsUpdateCustomerResponse> customers = toCustomers(osUpdates,
                deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                        POLICY_PLATFORM, identifiers, scopeMachineIds),
                deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(
                        identifiers, scopeMachineIds));
        Map<String, Set<OsUpdateCustomerStatus>> statusesByOsUpdateId = new HashMap<>();
        for (OsUpdateCustomerResponse customer : customers) {
            Set<OsUpdateCustomerStatus> statusesOfOsUpdate = statusesByOsUpdateId.computeIfAbsent(
                    customer.getOsUpdateId(), osUpdateId -> EnumSet.noneOf(OsUpdateCustomerStatus.class));
            statusesOfOsUpdate.add(customer.getStatus());
        }
        return statusesByOsUpdateId.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, statuses -> List.copyOf(statuses.getValue())));
    }

    // Updates that wait for a technician at a customer of the scope and are pending on a device of it.
    public int countHeldOsUpdates(OsUpdateDeviceScope osUpdateDeviceScope) {
        List<OsUpdateOrganizationDeviceCount> pendingDeviceCounts =
                deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                        POLICY_PLATFORM, null, osUpdateDeviceScope.getMachineIds());
        List<OsUpdateCustomerResponse> customers =
                toCustomers(findOsUpdatesOfDeviceCounts(pendingDeviceCounts), pendingDeviceCounts, List.of());
        return Math.toIntExact(customers.stream()
                .filter(customer -> customer.getStatus() == OsUpdateCustomerStatus.HELD)
                .map(OsUpdateCustomerResponse::getOsUpdateId)
                .distinct()
                .count());
    }

    // Pending: devices that list the update now, without the devices we cannot manage. Installed: devices whose
    // stored history has a successful install of it. Only Windows reports a history. Only the devices of the scope
    // are counted.
    public Map<String, OsUpdateDeviceCounts> countDevices(Collection<String> osUpdateIds,
                                                          OsUpdateDeviceScope osUpdateDeviceScope) {
        List<OsUpdate> osUpdates = osUpdateRepository.findByTenantIdAndIdIn(tenantIdProvider.getTenantId(), osUpdateIds);
        if (osUpdates.isEmpty()) {
            return Map.of();
        }
        List<String> scopeMachineIds = osUpdateDeviceScope.getMachineIds();
        Map<OsPlatform, List<OsUpdate>> osUpdatesByPlatform = osUpdates.stream()
                .collect(Collectors.groupingBy(OsUpdate::getPlatform));
        Map<String, OsUpdateDeviceCounts> deviceCountsByOsUpdateId = new HashMap<>();
        osUpdatesByPlatform.forEach((platform, platformOsUpdates) -> deviceCountsByOsUpdateId.putAll(
                countDevicesOfPlatform(platform, platformOsUpdates, scopeMachineIds)));
        return deviceCountsByOsUpdateId;
    }

    // Null = every update.
    private Collection<String> findOsUpdateIdsOfScope(OsUpdateFilter osUpdateFilter, List<String> scopeMachineIds) {
        if (!isEmpty(osUpdateFilter.getCustomerStatuses())) {
            return findOsUpdateIdsOfCustomerStatuses(osUpdateFilter.getCustomerStatuses(), scopeMachineIds);
        }
        return scopeMachineIds == null ? osUpdateFilter.getOsUpdateIds() : findOsUpdateIdsOfMachines(scopeMachineIds);
    }

    // Reads every update a device of the scope lists or installed: the status is not stored, so no index can
    // answer this.
    private List<String> findOsUpdateIdsOfCustomerStatuses(List<OsUpdateCustomerStatus> customerStatuses,
                                                           List<String> scopeMachineIds) {
        List<OsUpdateOrganizationDeviceCount> pendingDeviceCounts =
                deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                        POLICY_PLATFORM, null, scopeMachineIds);
        List<OsUpdateOrganizationDeviceCount> installedDeviceCounts =
                deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(null, scopeMachineIds);
        List<OsUpdateOrganizationDeviceCount> deviceCounts = new ArrayList<>(pendingDeviceCounts);
        deviceCounts.addAll(installedDeviceCounts);
        List<OsUpdateCustomerResponse> customers =
                toCustomers(findOsUpdatesOfDeviceCounts(deviceCounts), pendingDeviceCounts, installedDeviceCounts);
        return customers.stream()
                .filter(customer -> customerStatuses.contains(customer.getStatus()))
                .map(OsUpdateCustomerResponse::getOsUpdateId)
                .distinct()
                .toList();
    }

    private List<OsUpdate> findOsUpdatesOfDeviceCounts(List<OsUpdateOrganizationDeviceCount> deviceCounts) {
        Set<String> identifiers = deviceCounts.stream()
                .map(OsUpdateOrganizationDeviceCount::getIdentifier)
                .collect(Collectors.toSet());
        return osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                tenantIdProvider.getTenantId(), POLICY_PLATFORM, identifiers);
    }

    // One row per update and customer that has a device the update is pending on or installed by.
    private List<OsUpdateCustomerResponse> toCustomers(List<OsUpdate> osUpdates,
                                                       List<OsUpdateOrganizationDeviceCount> pendingDeviceCounts,
                                                       List<OsUpdateOrganizationDeviceCount> installedDeviceCounts) {
        if (osUpdates.isEmpty()) {
            return List.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<String> identifiers = osUpdates.stream().map(OsUpdate::getIdentifier).toList();
        List<OsUpdatePolicy> osUpdatePolicies = osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(tenantId);
        Map<String, List<OsUpdateOverride>> overridesByIdentifier = osUpdateOverrideRepository
                .findByTenantIdAndPlatformAndIdentifierIn(tenantId, POLICY_PLATFORM, identifiers).stream()
                .collect(Collectors.groupingBy(OsUpdateOverride::getIdentifier));
        Map<String, Map<String, Integer>> pendingByOrganizationIdByIdentifier =
                toCountByOrganizationIdByIdentifier(pendingDeviceCounts);
        Map<String, Map<String, Integer>> installedByOrganizationIdByIdentifier =
                toCountByOrganizationIdByIdentifier(installedDeviceCounts);
        Instant now = Instant.now();
        List<OsUpdateCustomerResponse> customers = new ArrayList<>();
        for (OsUpdate osUpdate : osUpdates) {
            String identifier = osUpdate.getIdentifier();
            Map<String, Integer> pendingByOrganizationId =
                    pendingByOrganizationIdByIdentifier.getOrDefault(identifier, Map.of());
            Map<String, Integer> installedByOrganizationId =
                    installedByOrganizationIdByIdentifier.getOrDefault(identifier, Map.of());
            List<OsUpdateOverride> overridesOfOsUpdate = overridesByIdentifier.getOrDefault(identifier, List.of());
            Set<String> organizationIds = new TreeSet<>(pendingByOrganizationId.keySet());
            organizationIds.addAll(installedByOrganizationId.keySet());
            for (String organizationId : organizationIds) {
                OsUpdateCustomerRollout osUpdateCustomerRollout = osUpdateCustomerStatusResolver.resolve(
                        osUpdatePolicies, overridesOfOsUpdate, osUpdate, organizationId, now);
                OsUpdateDeviceCounts osUpdateDeviceCounts = OsUpdateDeviceCounts.builder()
                        .pendingDeviceCount(pendingByOrganizationId.getOrDefault(organizationId, 0))
                        .installedDeviceCount(installedByOrganizationId.getOrDefault(organizationId, 0))
                        .build();
                customers.add(osUpdatePolicyResponseMapper.toResponse(
                        osUpdate, organizationId, osUpdateCustomerRollout, osUpdateDeviceCounts));
            }
        }
        return customers;
    }

    private static Map<String, Map<String, Integer>> toCountByOrganizationIdByIdentifier(
            List<OsUpdateOrganizationDeviceCount> deviceCounts) {
        return deviceCounts.stream()
                .collect(Collectors.groupingBy(OsUpdateOrganizationDeviceCount::getIdentifier, Collectors.toMap(
                        OsUpdateOrganizationDeviceCount::getOrganizationId,
                        deviceCount -> Math.toIntExact(deviceCount.getDeviceCount()))));
    }

    // An identifier names one update within one platform; only Windows reports a history.
    private List<String> findOsUpdateIdsOfMachines(List<String> machineIds) {
        String tenantId = tenantIdProvider.getTenantId();
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
