package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRolloutStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// Windows only: the agent of a Mac does not install OS updates by a policy yet.
@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceOsUpdateRolloutStateService {

    private static final OsPlatform PLATFORM = OsPlatform.WINDOWS;
    private static final int BATCH_SIZE = 500;

    private final TenantIdProvider tenantIdProvider;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    private final DeviceOsUpdateRolloutStateRepository deviceOsUpdateRolloutStateRepository;
    private final OsUpdateRepository osUpdateRepository;
    private final OsUpdatePolicyRepository osUpdatePolicyRepository;
    private final OsUpdateOverrideRepository osUpdateOverrideRepository;
    private final MachineRepository machineRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final OsUpdatePolicyResolver osUpdatePolicyResolver;
    private final OsUpdateOverrideResolver osUpdateOverrideResolver;
    private final DeviceOsUpdateRolloutStateCalculator deviceOsUpdateRolloutStateCalculator;

    // Every device that reports its OS, batchSize at a time by machine id.
    public void refreshAll() {
        refreshAll(BATCH_SIZE);
    }

    void refreshAll(int batchSize) {
        String tenantId = tenantIdProvider.getTenantId();
        String afterMachineId = "";
        List<DeviceOsState> deviceOsStates;
        do {
            deviceOsStates = deviceOsStateRepository.findDevicePage(
                    tenantId, PLATFORM, afterMachineId, Limit.of(batchSize));
            if (!deviceOsStates.isEmpty()) {
                refresh(tenantId, deviceOsStates);
                afterMachineId = deviceOsStates.getLast().getMachineId();
            }
        } while (deviceOsStates.size() == batchSize);
    }

    public void refreshMachines(Collection<String> machineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        refresh(tenantId, deviceOsStateRepository.findByTenantIdAndPlatformAndMachineIdIn(
                tenantId, PLATFORM, machineIds));
    }

    private void refresh(String tenantId, List<DeviceOsState> deviceOsStates) {
        List<String> machineIds = deviceOsStates.stream().map(DeviceOsState::getMachineId).toList();
        List<DeviceOsUpdateRolloutState> storedRolloutStates =
                deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineIdIn(tenantId, machineIds);
        List<DeviceOsUpdateRolloutState> calculatedRolloutStates =
                calculateRolloutStates(tenantId, findManageableMachineIds(deviceOsStates));
        saveChanged(storedRolloutStates, calculatedRolloutStates);
    }

    // A device we cannot manage follows no policy: whatever is stored for it is removed.
    private List<String> findManageableMachineIds(List<DeviceOsState> deviceOsStates) {
        return deviceOsStates.stream()
                .filter(deviceOsState -> deviceOsState.getManageability() != null)
                .filter(deviceOsState ->
                        deviceOsState.getManageability().getState() == OsUpdateManageabilityState.MANAGEABLE)
                .map(DeviceOsState::getMachineId)
                .toList();
    }

    private List<DeviceOsUpdateRolloutState> calculateRolloutStates(String tenantId, List<String> machineIds) {
        List<OsUpdatePolicy> osUpdatePolicies = osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(tenantId);
        if (osUpdatePolicies.isEmpty() || machineIds.isEmpty()) {
            return List.of();
        }
        Map<String, Set<String>> tagIdsByMachineId = findTagIdsByMachineId(osUpdatePolicies, machineIds);
        Map<String, List<DeviceOsPendingUpdate>> pendingUpdatesByMachineId =
                deviceOsPendingUpdateRepository.findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                        .collect(Collectors.groupingBy(DeviceOsPendingUpdate::getMachineId));
        Set<String> identifiers = pendingUpdatesByMachineId.values().stream()
                .flatMap(List::stream)
                .map(DeviceOsPendingUpdate::getIdentifier)
                .collect(Collectors.toSet());
        Map<String, OsUpdate> osUpdatesByIdentifier =
                osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(tenantId, PLATFORM, identifiers).stream()
                        .collect(Collectors.toMap(OsUpdate::getIdentifier, Function.identity()));
        Map<String, List<OsUpdateOverride>> overridesByIdentifier =
                osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifierIn(tenantId, PLATFORM, identifiers)
                        .stream()
                        .collect(Collectors.groupingBy(OsUpdateOverride::getIdentifier));

        List<DeviceOsUpdateRolloutState> calculatedRolloutStates = new ArrayList<>();
        for (Machine machine : machineRepository.findByTenantIdAndMachineIdIn(tenantId, machineIds)) {
            Set<String> machineTagIds = tagIdsByMachineId.getOrDefault(machine.getMachineId(), Set.of());
            OsUpdatePolicy osUpdatePolicy = osUpdatePolicyResolver.resolve(osUpdatePolicies, machine, machineTagIds);
            if (osUpdatePolicy == null) {
                continue;
            }
            boolean pilotDevice = osUpdatePolicy.getPilotTagId() != null
                    && machineTagIds.contains(osUpdatePolicy.getPilotTagId());
            for (DeviceOsPendingUpdate deviceOsPendingUpdate
                    : pendingUpdatesByMachineId.getOrDefault(machine.getMachineId(), List.of())) {
                OsUpdate osUpdate = osUpdatesByIdentifier.get(deviceOsPendingUpdate.getIdentifier());
                if (osUpdate == null) {
                    continue;
                }
                OsUpdateOverride osUpdateOverride = osUpdateOverrideResolver.resolve(
                        overridesByIdentifier.getOrDefault(osUpdate.getIdentifier(), List.of()), machine);
                DeviceOsUpdateRolloutState calculatedRolloutState = deviceOsUpdateRolloutStateCalculator.calculate(
                        osUpdatePolicy, pilotDevice, osUpdate, deviceOsPendingUpdate, osUpdateOverride);
                if (calculatedRolloutState != null) {
                    calculatedRolloutStates.add(calculatedRolloutState);
                }
            }
        }
        return calculatedRolloutStates;
    }

    // Only the tags a policy names, as a target or as its pilot ring.
    private Map<String, Set<String>> findTagIdsByMachineId(List<OsUpdatePolicy> osUpdatePolicies,
                                                           List<String> machineIds) {
        List<String> policyTagIds = osUpdatePolicies.stream()
                .flatMap(osUpdatePolicy -> Stream.concat(
                        Stream.ofNullable(osUpdatePolicy.getTarget().getTagIds()).flatMap(List::stream),
                        Stream.ofNullable(osUpdatePolicy.getPilotTagId())))
                .distinct()
                .toList();
        if (policyTagIds.isEmpty()) {
            return Map.of();
        }
        return tagAssignmentRepository
                .findByEntityIdInAndTagIdInAndEntityType(machineIds, policyTagIds, TagEntityType.DEVICE).stream()
                .collect(Collectors.groupingBy(TagAssignment::getEntityId,
                        Collectors.mapping(TagAssignment::getTagId, Collectors.toSet())));
    }

    // A calculated state takes the id of the stored one of its device and update; a stored one nothing was
    // calculated for is removed.
    private void saveChanged(List<DeviceOsUpdateRolloutState> storedRolloutStates,
                             List<DeviceOsUpdateRolloutState> calculatedRolloutStates) {
        Map<String, DeviceOsUpdateRolloutState> storedByKey = storedRolloutStates.stream()
                .collect(Collectors.toMap(this::keyOf, Function.identity()));
        List<DeviceOsUpdateRolloutState> changedRolloutStates = new ArrayList<>();
        for (DeviceOsUpdateRolloutState calculatedRolloutState : calculatedRolloutStates) {
            DeviceOsUpdateRolloutState storedRolloutState = storedByKey.remove(keyOf(calculatedRolloutState));
            if (storedRolloutState != null) {
                calculatedRolloutState.setId(storedRolloutState.getId());
            }
            if (!Objects.equals(calculatedRolloutState, storedRolloutState)) {
                changedRolloutStates.add(calculatedRolloutState);
            }
        }
        deviceOsUpdateRolloutStateRepository.saveAll(changedRolloutStates);
        deviceOsUpdateRolloutStateRepository.deleteAll(storedByKey.values());
    }

    private String keyOf(DeviceOsUpdateRolloutState deviceOsUpdateRolloutState) {
        return deviceOsUpdateRolloutState.getMachineId() + '|' + deviceOsUpdateRolloutState.getIdentifier();
    }
}
