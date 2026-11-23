package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OsUpdateService {

    private final OsUpdateRepository osUpdateRepository;

    // An update is described once, by the first device that reports it. Later reports do not change it.
    public void saveMissing(List<OsUpdate> reportedOsUpdates) {
        osUpdateRepository.insertMissing(reportedOsUpdates);
    }
}
