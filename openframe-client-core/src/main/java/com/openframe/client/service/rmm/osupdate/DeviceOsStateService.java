package com.openframe.client.service.rmm.osupdate;

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

    // false = a newer report of this device is already stored, so nothing of this one may be applied.
    public boolean saveIfNotOlder(DeviceOsState reportedState) {
        Instant rebootPendingSince = resolveRebootPendingSince(reportedState);
        reportedState.setRebootPendingSince(rebootPendingSince);
        return deviceOsStateRepository.replaceUnlessNewerStored(reportedState);
    }

    // The moment the reboot became pending is kept from the stored state while the device keeps reporting it.
    private Instant resolveRebootPendingSince(DeviceOsState reportedState) {
        if (reportedState.getRebootPending() != OsRebootPending.YES) {
            return null;
        }
        Optional<DeviceOsState> storedState = deviceOsStateRepository.findByTenantIdAndMachineId(
                reportedState.getTenantId(), reportedState.getMachineId());
        return storedState
                .map(DeviceOsState::getRebootPendingSince)
                .orElse(reportedState.getReceivedAt());
    }
}
