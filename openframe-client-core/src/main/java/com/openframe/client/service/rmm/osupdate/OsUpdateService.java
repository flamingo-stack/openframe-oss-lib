package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OsUpdateService {

    private final OsUpdateRepository osUpdateRepository;
    private final OsUpdateClassifier osUpdateClassifier;
    private final StoredOsUpdateRefresher storedOsUpdateRefresher;
    private final DeviceOsReportMetrics deviceOsReportMetrics;

    // An update is described by the first device that reports it. Later reports only fill in what it lacks for
    // its classification, and every report classifies it again by the current rule.
    public void saveReported(List<OsUpdate> reportedOsUpdates) {
        if (reportedOsUpdates.isEmpty()) {
            return;
        }
        Map<String, OsUpdate> storedOsUpdates = findStoredByIdentifier(reportedOsUpdates);
        List<OsUpdate> refreshedOsUpdates = new ArrayList<>();
        for (OsUpdate reportedOsUpdate : reportedOsUpdates) {
            OsUpdate storedOsUpdate = storedOsUpdates.get(reportedOsUpdate.getIdentifier());
            if (storedOsUpdate == null) {
                saveUnlessStoredMeanwhile(reportedOsUpdate);
            } else if (!refreshedOsUpdates.contains(storedOsUpdate)
                    && storedOsUpdateRefresher.refresh(storedOsUpdate, reportedOsUpdate)) {
                refreshedOsUpdates.add(storedOsUpdate);
            }
        }
        saveRefreshed(refreshedOsUpdates);
    }

    // The updates of one report: one tenant and one platform.
    private Map<String, OsUpdate> findStoredByIdentifier(List<OsUpdate> reportedOsUpdates) {
        OsUpdate anyReportedOsUpdate = reportedOsUpdates.getFirst();
        List<String> reportedIdentifiers = reportedOsUpdates.stream()
                .map(OsUpdate::getIdentifier)
                .toList();
        List<OsUpdate> storedOsUpdates = osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                anyReportedOsUpdate.getTenantId(), anyReportedOsUpdate.getPlatform(), reportedIdentifiers);
        return storedOsUpdates.stream()
                .collect(Collectors.toMap(OsUpdate::getIdentifier, Function.identity()));
    }

    private void saveRefreshed(List<OsUpdate> refreshedOsUpdates) {
        if (refreshedOsUpdates.isEmpty()) {
            return;
        }
        osUpdateRepository.saveAll(refreshedOsUpdates);
        refreshedOsUpdates.forEach(refreshedOsUpdate ->
                deviceOsReportMetrics.recordOsUpdateReclassified(refreshedOsUpdate.getPlatform()));
    }
    // One by one: another device of the tenant reporting the same new update must not stop the rest.
    private void saveUnlessStoredMeanwhile(OsUpdate missingOsUpdate) {
        OsUpdateClassification classification = osUpdateClassifier.classify(missingOsUpdate);
        missingOsUpdate.setClassification(classification);
        try {
            osUpdateRepository.save(missingOsUpdate);
            deviceOsReportMetrics.recordOsUpdateSaved(missingOsUpdate.getPlatform());
        } catch (DuplicateKeyException storedMeanwhile) {
            log.debug("OS update {} of tenantId={} was stored by another report meanwhile",
                    missingOsUpdate.getIdentifier(), missingOsUpdate.getTenantId());
        }
    }
}
