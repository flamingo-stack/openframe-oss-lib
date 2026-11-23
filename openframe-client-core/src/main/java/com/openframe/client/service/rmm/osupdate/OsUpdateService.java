package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OsUpdateService {

    private final OsUpdateRepository osUpdateRepository;

    // An update is described once, by the first device that reports it. Later reports do not change it.
    public void saveMissing(List<OsUpdate> reportedOsUpdates) {
        if (reportedOsUpdates.isEmpty()) {
            return;
        }
        Set<String> storedIdentifiers = findStoredIdentifiers(reportedOsUpdates);
        reportedOsUpdates.stream()
                .filter(reportedOsUpdate -> !storedIdentifiers.contains(reportedOsUpdate.getIdentifier()))
                .forEach(this::saveUnlessStoredMeanwhile);
    }

    // The updates of one report: one tenant and one platform.
    private Set<String> findStoredIdentifiers(List<OsUpdate> reportedOsUpdates) {
        OsUpdate anyReportedOsUpdate = reportedOsUpdates.getFirst();
        List<String> reportedIdentifiers = reportedOsUpdates.stream()
                .map(OsUpdate::getIdentifier)
                .toList();
        List<OsUpdate> storedOsUpdates = osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                anyReportedOsUpdate.getTenantId(), anyReportedOsUpdate.getPlatform(), reportedIdentifiers);
        return storedOsUpdates.stream()
                .map(OsUpdate::getIdentifier)
                .collect(Collectors.toSet());
    }

    // One by one: another device of the tenant reporting the same new update must not stop the rest.
    private void saveUnlessStoredMeanwhile(OsUpdate missingOsUpdate) {
        try {
            osUpdateRepository.save(missingOsUpdate);
        } catch (DuplicateKeyException storedMeanwhile) {
            log.debug("OS update {} of tenantId={} was stored by another report meanwhile",
                    missingOsUpdate.getIdentifier(), missingOsUpdate.getTenantId());
        }
    }
}
