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
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import com.openframe.data.service.machine.MachineField;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.query.Criteria;
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

import static com.openframe.data.service.machine.MachineFields.OS_BUILD;
import static com.openframe.data.service.machine.MachineFields.OS_STATE;
import static com.openframe.data.service.machine.MachineFields.OS_VERSION;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.apache.commons.lang3.StringUtils.defaultIfBlank;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class MachineOsUpdatesService {

    private static final String RECEIVED_AT_PATH = OS_STATE.path() + ".receivedAt";
    private static final Set<OsUpdateInstallResult> SUCCEEDED_RESULTS =
            EnumSet.of(OsUpdateInstallResult.SUCCEEDED, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS);

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
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
        MachineUpdate stateUpdate = toStateUpdate(machine, report.getOsState(), history, receivedAt);
        if (machineWriter.update(machineId, storedNotNewerThan(receivedAt), stateUpdate).isEmpty()) {
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

    private static Criteria storedNotNewerThan(Instant receivedAt) {
        Criteria neverReceived = Criteria.where(RECEIVED_AT_PATH).isNull();
        Criteria receivedEarlier = Criteria.where(RECEIVED_AT_PATH).lte(receivedAt);
        return new Criteria().orOperator(neverReceived, receivedEarlier);
    }

    private MachineUpdate toStateUpdate(Machine machine, MachineOsUpdatesMessage.OsState reported,
                                        List<DeviceOsUpdateHistoryEntry> history, Instant receivedAt) {
        MachineUpdate stateUpdate = machineUpdate();
        setIfReported(stateUpdate, OS_VERSION, reported.getOsVersion());
        setIfReported(stateUpdate, OS_BUILD, reported.getOsBuild());
        return stateUpdate.set(OS_STATE, toOsState(machine, reported, history, receivedAt));
    }

    private static void setIfReported(MachineUpdate stateUpdate, MachineField<String> field, String reported) {
        if (isNotBlank(reported)) {
            stateUpdate.set(field, reported);
        }
    }

    private DeviceOsState toOsState(Machine machine, MachineOsUpdatesMessage.OsState reported,
                                    List<DeviceOsUpdateHistoryEntry> history, Instant receivedAt) {
        return DeviceOsState.builder()
                .restartPending(reported.getRestartPending())
                .restartPendingSince(restartPendingSince(machine.getOsState(), reported, receivedAt).orElse(null))
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

    private static Optional<Instant> restartPendingSince(DeviceOsState stored, MachineOsUpdatesMessage.OsState reported,
                                                         Instant receivedAt) {
        if (!Boolean.TRUE.equals(reported.getRestartPending())) {
            return Optional.empty();
        }
        Instant since = stored != null && stored.getRestartPendingSince() != null
                ? stored.getRestartPendingSince() : receivedAt;
        return Optional.of(since);
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
