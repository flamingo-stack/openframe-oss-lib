package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceOsPendingUpdateService {

    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;

    // The report is the device's whole list: what it no longer names is gone, what it names again keeps its
    // discoveredAt.
    public void replacePendingUpdates(Machine machine, List<DeviceOsPendingUpdate> reportedPendingUpdates) {
        Set<String> reportedIdentifiers = reportedPendingUpdates.stream()
                .map(DeviceOsPendingUpdate::getIdentifier)
                .collect(Collectors.toSet());
        deviceOsPendingUpdateRepository.deleteByTenantIdAndMachineIdAndIdentifierNotIn(
                machine.getTenantId(), machine.getMachineId(), reportedIdentifiers);
        deviceOsPendingUpdateRepository.upsertKeepingDiscoveredAt(reportedPendingUpdates);
    }
}
