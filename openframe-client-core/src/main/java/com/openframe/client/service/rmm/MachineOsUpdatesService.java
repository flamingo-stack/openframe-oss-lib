package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.apache.commons.lang3.StringUtils.defaultIfBlank;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class MachineOsUpdatesService {

    private static final Set<OsUpdateInstallResult> SUCCEEDED_RESULTS =
            EnumSet.of(OsUpdateInstallResult.SUCCEEDED, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS);

    private final MachineRepository machineRepository;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceOsUpdateRepository deviceOsUpdateRepository;
    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    private final OsUpdateReportMapper osUpdateReportMapper;

    public void apply(String machineId, MachineOsUpdatesMessage report, Instant receivedAt) {
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("OS-updates report for unknown machine {}, ignoring", machineId);
            return;
        }
        Machine machine = foundMachine.get();
        if (isFrozen(machine)) {
            log.debug("Ignoring OS-updates report for machineId={} in status {}", machineId, machine.getStatus());
            return;
        }

        String tenantId = machine.getTenantId();
        List<DeviceOsUpdateHistoryEntry> history =
                osUpdateReportMapper.toHistoryEntries(tenantId, machineId, report.getInstallHistory());
        DeviceOsState osState = toOsState(machine, report.getOsState(), history, receivedAt);
        if (!deviceOsStateRepository.upsertUnlessNewerStored(osState)) {
            log.info("Ignoring OS-updates report for machineId={} received at {}: a newer one is applied",
                    machineId, receivedAt);
            return;
        }

        if (carriesPendingList(report)) {
            List<DeviceOsUpdate> pending = osUpdateReportMapper.toPendingUpdates(
                    tenantId, machineId, report.getPendingUpdates(), discoveredAt(report.getOsState(), receivedAt));
            replacePending(tenantId, machineId, pending);
        }
        insertUnseen(tenantId, machineId, history);
    }

    private static boolean isFrozen(Machine machine) {
        return DeviceStatus.FROZEN.contains(machine.getStatus());
    }

    private static boolean carriesPendingList(MachineOsUpdatesMessage report) {
        return report.getPendingUpdates() != null && isBlank(report.getOsState().getLastScanError());
    }

    private static Instant discoveredAt(MachineOsUpdatesMessage.OsState reported, Instant receivedAt) {
        return reported.getLastScanAt() != null ? reported.getLastScanAt() : receivedAt;
    }

    private DeviceOsState toOsState(Machine machine, MachineOsUpdatesMessage.OsState reported,
                                    List<DeviceOsUpdateHistoryEntry> history, Instant receivedAt) {
        return DeviceOsState.builder()
                .tenantId(machine.getTenantId())
                .machineId(machine.getMachineId())
                .osVersion(defaultIfBlank(reported.getOsVersion(), null))
                .osBuild(defaultIfBlank(reported.getOsBuild(), null))
                .restartPending(reported.getRestartPending())
                .restartPendingSince(restartPendingSince(machine, reported, receivedAt).orElse(null))
                .lastScanAt(reported.getLastScanAt())
                .lastScanError(defaultIfBlank(reported.getLastScanError(), null))
                .lastInstalledAt(lastInstalledAt(machine, history).orElse(null))
                .managementState(reported.getManagementState())
                .managedElsewhereReason(reported.getManagedElsewhereReason())
                .observedReason(reported.getObservedReason())
                .authorization(reported.getOsUpdateAuthorization())
                .receivedAt(receivedAt)
                .build();
    }

    private Optional<Instant> restartPendingSince(Machine machine, MachineOsUpdatesMessage.OsState reported,
                                                  Instant receivedAt) {
        if (!Boolean.TRUE.equals(reported.getRestartPending())) {
            return Optional.empty();
        }
        return deviceOsStateRepository.findByTenantIdAndMachineId(machine.getTenantId(), machine.getMachineId())
                .map(DeviceOsState::getRestartPendingSince)
                .or(() -> Optional.of(receivedAt));
    }

    private Optional<Instant> lastInstalledAt(Machine machine, List<DeviceOsUpdateHistoryEntry> reported) {
        Optional<DeviceOsUpdateHistoryEntry> stored = deviceOsUpdateHistoryRepository
                .findFirstByTenantIdAndMachineIdAndOperationAndResultInOrderByInstalledAtDesc(
                        machine.getTenantId(), machine.getMachineId(), OsUpdateOperation.INSTALL, SUCCEEDED_RESULTS);
        Stream<DeviceOsUpdateHistoryEntry> reportedInstalls = reported.stream()
                .filter(entry -> entry.getOperation() == OsUpdateOperation.INSTALL)
                .filter(entry -> SUCCEEDED_RESULTS.contains(entry.getResult()));
        return Stream.concat(stored.stream(), reportedInstalls)
                .map(DeviceOsUpdateHistoryEntry::getInstalledAt)
                .max(Comparator.naturalOrder());
    }

    private void replacePending(String tenantId, String machineId, List<DeviceOsUpdate> reported) {
        Map<String, DeviceOsUpdate> storedByUpdateKey = new HashMap<>();
        deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(tenantId, machineId)
                .forEach(stored -> storedByUpdateKey.put(stored.getUpdateKey(), stored));

        reported.forEach(update -> keepStoredIdentity(update, storedByUpdateKey));
        List<DeviceOsUpdate> changed = reported.stream()
                .filter(update -> !update.equals(storedByUpdateKey.get(update.getUpdateKey())))
                .toList();
        List<String> withdrawnIds = withdrawnIds(reported, storedByUpdateKey);

        if (!changed.isEmpty()) {
            deviceOsUpdateRepository.saveAll(changed);
        }
        if (!withdrawnIds.isEmpty()) {
            deviceOsUpdateRepository.deleteByTenantIdAndIdIn(tenantId, withdrawnIds);
        }
    }

    private static void keepStoredIdentity(DeviceOsUpdate update, Map<String, DeviceOsUpdate> storedByUpdateKey) {
        DeviceOsUpdate stored = storedByUpdateKey.get(update.getUpdateKey());
        if (stored != null) {
            update.setId(stored.getId());
            update.setDiscoveredAt(stored.getDiscoveredAt());
        }
    }

    private static List<String> withdrawnIds(List<DeviceOsUpdate> reported,
                                             Map<String, DeviceOsUpdate> storedByUpdateKey) {
        Set<String> reportedKeys = reported.stream().map(DeviceOsUpdate::getUpdateKey).collect(Collectors.toSet());
        return storedByUpdateKey.values().stream()
                .filter(stored -> !reportedKeys.contains(stored.getUpdateKey()))
                .map(DeviceOsUpdate::getId)
                .toList();
    }

    private void insertUnseen(String tenantId, String machineId, List<DeviceOsUpdateHistoryEntry> reported) {
        if (reported.isEmpty()) {
            return;
        }
        List<String> reportedKeys = reported.stream().map(DeviceOsUpdateHistoryEntry::getEntryKey).toList();
        List<String> storedKeys = deviceOsUpdateHistoryRepository.findEntryKeys(tenantId, machineId, reportedKeys);
        List<DeviceOsUpdateHistoryEntry> unseen = reported.stream()
                .filter(entry -> !storedKeys.contains(entry.getEntryKey()))
                .toList();
        if (!unseen.isEmpty()) {
            deviceOsUpdateHistoryRepository.insert(unseen);
        }
    }
}
