package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DeviceOsUpdateHistoryService {

    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;

    // History only grows: every report repeats the device's past installs, and each is stored once.
    public void saveMissing(List<DeviceOsUpdateHistoryEntry> reportedHistoryEntries) {
        deviceOsUpdateHistoryRepository.insertMissing(reportedHistoryEntries);
    }
}
