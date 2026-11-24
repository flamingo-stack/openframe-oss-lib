package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.service.rmm.osupdate.parser.DeviceOsReportParser;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DeviceOsReportFacade {

    private final MachineRepository machineRepository;
    private final DeviceOsReportParser deviceOsReportParser;
    private final DeviceOsStateService deviceOsStateService;
    private final OsUpdateService osUpdateService;
    private final DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    private final DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    private final DeviceOsUpdateHistoryLogService deviceOsUpdateHistoryLogService;
    private final DeviceOsReportMetrics deviceOsReportMetrics;

    public DeviceOsReportOutcome applyReport(String machineId, byte[] payload, Instant receivedAt) {
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("OS report of unknown machine {}, ignoring", machineId);
            return DeviceOsReportOutcome.UNKNOWN_MACHINE;
        }
        Machine machine = foundMachine.get();
        if (DeviceStatus.FROZEN.contains(machine.getStatus())) {
            log.debug("Ignoring OS report of machineId={} in status {}", machineId, machine.getStatus());
            return DeviceOsReportOutcome.FROZEN_MACHINE;
        }

        DeviceOsReport deviceOsReport = deviceOsReportParser.parse(machine, payload, receivedAt);

        boolean stateSaved = deviceOsStateService.saveIfNotOlder(deviceOsReport.getDeviceOsState());
        if (!stateSaved) {
            log.info("Ignoring OS report of machineId={} received at {}: a newer one is applied", machineId, receivedAt);
            return DeviceOsReportOutcome.IGNORED_OLDER;
        }

        if (deviceOsReport.isPendingUpdatesReadable()) {
            osUpdateService.saveMissing(deviceOsReport.getOsUpdates());
            deviceOsPendingUpdateService.replacePendingUpdates(machine, deviceOsReport.getPendingUpdates());
        }

        List<DeviceOsUpdateHistoryEntry> newHistoryEntries =
                deviceOsUpdateHistoryService.saveMissing(machine, deviceOsReport.getHistoryEntries());
        deviceOsUpdateHistoryLogService.logNewEntries(newHistoryEntries);

        deviceOsReportMetrics.recordApplied(deviceOsReport);
        return DeviceOsReportOutcome.APPLIED;
    }
}
