package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceOsPendingUpdateService {

    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;

    // The report is the device's whole list: what it no longer names is gone, what it names again keeps its
    // discoveredAt.
    public void replacePendingUpdates(Machine machine, List<DeviceOsPendingUpdate> reportedPendingUpdates) {
        List<DeviceOsPendingUpdate> storedPendingUpdates =
                deviceOsPendingUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(
                        machine.getTenantId(), machine.getMachineId());

        List<DeviceOsPendingUpdate> noLongerReported = findNoLongerReported(storedPendingUpdates, reportedPendingUpdates);
        List<DeviceOsPendingUpdate> newOrChanged = findNewOrChanged(storedPendingUpdates, reportedPendingUpdates);

        deviceOsPendingUpdateRepository.deleteAll(noLongerReported);
        deviceOsPendingUpdateRepository.saveAll(newOrChanged);
    }

    private static List<DeviceOsPendingUpdate> findNoLongerReported(List<DeviceOsPendingUpdate> storedPendingUpdates,
                                                                    List<DeviceOsPendingUpdate> reportedPendingUpdates) {
        Set<String> reportedIdentifiers = reportedPendingUpdates.stream()
                .map(DeviceOsPendingUpdate::getIdentifier)
                .collect(Collectors.toSet());
        return storedPendingUpdates.stream()
                .filter(storedPendingUpdate -> !reportedIdentifiers.contains(storedPendingUpdate.getIdentifier()))
                .toList();
    }

    private static List<DeviceOsPendingUpdate> findNewOrChanged(List<DeviceOsPendingUpdate> storedPendingUpdates,
                                                                List<DeviceOsPendingUpdate> reportedPendingUpdates) {
        Map<String, DeviceOsPendingUpdate> storedByIdentifier = storedPendingUpdates.stream()
                .collect(Collectors.toMap(DeviceOsPendingUpdate::getIdentifier, Function.identity()));
        return reportedPendingUpdates.stream()
                .map(reportedPendingUpdate -> continueStored(
                        reportedPendingUpdate, storedByIdentifier.get(reportedPendingUpdate.getIdentifier())))
                .filter(pendingUpdate -> !pendingUpdate.equals(storedByIdentifier.get(pendingUpdate.getIdentifier())))
                .toList();
    }

    // An update the device already had pending stays the same document with the same discoveredAt.
    private static DeviceOsPendingUpdate continueStored(DeviceOsPendingUpdate reportedPendingUpdate,
                                                        DeviceOsPendingUpdate storedPendingUpdate) {
        if (storedPendingUpdate == null) {
            return reportedPendingUpdate;
        }
        reportedPendingUpdate.setId(storedPendingUpdate.getId());
        reportedPendingUpdate.setDiscoveredAt(storedPendingUpdate.getDiscoveredAt());
        return reportedPendingUpdate;
    }
}
