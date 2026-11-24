package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceOsStateService {

    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceOsReportMetrics deviceOsReportMetrics;

    // false = a newer report of this device is already stored, so nothing of this one may be applied.
    public boolean saveIfNotOlder(DeviceOsState reportedState) {
        Optional<DeviceOsState> foundState = deviceOsStateRepository.findByTenantIdAndMachineId(
                reportedState.getTenantId(), reportedState.getMachineId());
        if (foundState.isEmpty()) {
            saveFirstState(reportedState);
            return true;
        }
        DeviceOsState storedState = foundState.get();
        if (isOlder(reportedState, storedState)) {
            return false;
        }
        replaceStoredState(storedState, reportedState);
        return true;
    }

    private void saveFirstState(DeviceOsState reportedState) {
        Instant rebootPendingSince = resolveRebootPendingSince(reportedState, reportedState.getReceivedAt());
        reportedState.setRebootPendingSince(rebootPendingSince);
        deviceOsStateRepository.save(reportedState);
        deviceOsReportMetrics.recordFirstReport(reportedState.getPlatform());
    }

    // The version is the stored one: when another report replaced the state meanwhile, the save fails and the
    // report is delivered again instead of overwriting it.
    private void replaceStoredState(DeviceOsState storedState, DeviceOsState reportedState) {
        Instant rebootPendingSince = resolveRebootPendingSince(reportedState, storedState.getRebootPendingSince());
        reportedState.setId(storedState.getId());
        reportedState.setVersion(storedState.getVersion());
        reportedState.setRebootPendingSince(rebootPendingSince);
        deviceOsStateRepository.save(reportedState);
        deviceOsReportMetrics.recordReportInterval(
                reportedState.getPlatform(), storedState.getReceivedAt(), reportedState.getReceivedAt());
    }

    private static boolean isOlder(DeviceOsState reportedState, DeviceOsState storedState) {
        return reportedState.getReceivedAt().isBefore(storedState.getReceivedAt());
    }

    // The moment the reboot became pending is kept while the device keeps reporting it.
    private static Instant resolveRebootPendingSince(DeviceOsState reportedState, Instant pendingSince) {
        if (reportedState.getRebootPending() != OsRebootPending.YES) {
            return null;
        }
        return pendingSince != null ? pendingSince : reportedState.getReceivedAt();
    }
}
