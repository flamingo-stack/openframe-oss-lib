package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceOsUpdateHistoryService {

    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;

    // Every report repeats the device's past installs, and each is stored once. Installs older than the retention
    // are not stored: the collection has already dropped them, and the report would bring them back.
    // Returns the entries stored now, for the first time.
    public List<DeviceOsUpdateHistoryEntry> saveMissing(Machine machine,
                                                        List<DeviceOsUpdateHistoryEntry> reportedHistoryEntries) {
        List<DeviceOsUpdateHistoryEntry> retainedEntries = findWithinRetention(reportedHistoryEntries);
        if (retainedEntries.isEmpty()) {
            return List.of();
        }
        Set<String> storedEntryKeys = findStoredEntryKeys(machine, retainedEntries);
        List<DeviceOsUpdateHistoryEntry> missingEntries = retainedEntries.stream()
                .filter(retainedEntry -> !storedEntryKeys.contains(retainedEntry.getEntryKey()))
                .toList();
        return deviceOsUpdateHistoryRepository.saveAll(missingEntries);
    }

    private static List<DeviceOsUpdateHistoryEntry> findWithinRetention(
            List<DeviceOsUpdateHistoryEntry> reportedHistoryEntries) {
        Instant oldestRetained = Instant.now().minus(DeviceOsUpdateHistoryEntry.RETENTION);
        return reportedHistoryEntries.stream()
                .filter(reportedEntry -> reportedEntry.getInstalledAt().isAfter(oldestRetained))
                .toList();
    }

    private Set<String> findStoredEntryKeys(Machine machine, List<DeviceOsUpdateHistoryEntry> reportedHistoryEntries) {
        List<String> reportedEntryKeys = reportedHistoryEntries.stream()
                .map(DeviceOsUpdateHistoryEntry::getEntryKey)
                .toList();
        List<DeviceOsUpdateHistoryEntry> storedEntries =
                deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                        machine.getTenantId(), machine.getMachineId(), reportedEntryKeys);
        return storedEntries.stream()
                .map(DeviceOsUpdateHistoryEntry::getEntryKey)
                .collect(Collectors.toSet());
    }
}
