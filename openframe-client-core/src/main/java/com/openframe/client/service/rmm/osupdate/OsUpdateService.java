package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.metrics.OsUpdateEnrichmentMetrics;
import com.openframe.client.service.rmm.osupdate.enrichment.OsUpdateEnricher;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
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
    private final ObjectProvider<OsUpdateEnricher> osUpdateEnrichers;
    private final OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;
    private final TenantIdProvider tenantIdProvider;

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

    // Updates never enriched or enriched before the given time, at most limit of them, the least recently attempted
    // first. An update no enricher applies to is only marked as checked; one whose source failed is retried after
    // the others.
    public void enrichNotEnrichedSince(Instant enrichedBefore, int limit) {
        Timer.Sample runStarted = osUpdateEnrichmentMetrics.startRun();
        String tenantId = tenantIdProvider.getTenantId();
        PageRequest firstPage = PageRequest.of(0, limit);
        List<OsUpdate> staleOsUpdates = osUpdateRepository.findEnrichedBefore(tenantId, enrichedBefore, firstPage);
        Instant enrichedAt = Instant.now();
        List<OsUpdate> unclaimedOsUpdates = new ArrayList<>(staleOsUpdates);
        osUpdateEnrichers.orderedStream()
                .forEach(osUpdateEnricher -> claimAndEnrich(osUpdateEnricher, unclaimedOsUpdates, enrichedAt));
        for (OsUpdate unclaimedOsUpdate : unclaimedOsUpdates) {
            unclaimedOsUpdate.setEnrichedAt(enrichedAt);
            osUpdateEnrichmentMetrics.recordNoData(unclaimedOsUpdate.getPlatform());
        }
        for (OsUpdate staleOsUpdate : staleOsUpdates) {
            staleOsUpdate.setEnrichmentAttemptedAt(enrichedAt);
            saveEnrichedUnlessChangedMeanwhile(staleOsUpdate);
        }
        osUpdateEnrichmentMetrics.recordRun(runStarted);
    }

    private void claimAndEnrich(OsUpdateEnricher osUpdateEnricher, List<OsUpdate> unclaimedOsUpdates,
                                Instant enrichedAt) {
        List<OsUpdate> applicableOsUpdates = unclaimedOsUpdates.stream()
                .filter(osUpdateEnricher::applicableTo)
                .toList();
        unclaimedOsUpdates.removeAll(applicableOsUpdates);
        enrichSafely(osUpdateEnricher, applicableOsUpdates, enrichedAt);
    }

    // One by one: an entry a report changed meanwhile is skipped and enriched on the next run.
    private void saveEnrichedUnlessChangedMeanwhile(OsUpdate enrichedOsUpdate) {
        try {
            osUpdateRepository.save(enrichedOsUpdate);
        } catch (OptimisticLockingFailureException changedMeanwhile) {
            log.debug("OS update {} of tenantId={} was changed meanwhile, enriched on the next run",
                    enrichedOsUpdate.getIdentifier(), enrichedOsUpdate.getTenantId());
        }
    }

    // One broken enricher must not keep the other platforms from being enriched.
    private void enrichSafely(OsUpdateEnricher osUpdateEnricher, List<OsUpdate> osUpdates, Instant enrichedAt) {
        if (osUpdates.isEmpty()) {
            return;
        }
        try {
            osUpdateEnricher.enrich(osUpdates, enrichedAt);
        } catch (RuntimeException failure) {
            log.error("OS update enricher {} failed", osUpdateEnricher.getClass().getSimpleName(), failure);
            osUpdates.forEach(osUpdate -> {
                if (enrichedAt.equals(osUpdate.getEnrichedAt())) {
                    osUpdate.setEnrichedAt(null);
                }
            });
        }
    }
}
