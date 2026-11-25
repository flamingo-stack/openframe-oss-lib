package com.openframe.management.osupdate;

import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsVersionBuild;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.OsVersionBuildRepository;
import com.openframe.data.service.TenantIdProvider;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.enrichment.enabled"},
        havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class OsUpdateEnrichmentService {

    private final OsUpdateRepository osUpdateRepository;
    private final ObjectProvider<OsUpdateEnricher> osUpdateEnrichers;
    private final OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;
    private final TenantIdProvider tenantIdProvider;
    private final OsVersionBuildRepository osVersionBuildRepository;
    private final MsrcCvrfClient msrcCvrfClient;

    // Every update never enriched or enriched before the given time, batchSize at a time by id. An update no
    // enricher applies to is only marked as checked; one whose source failed waits for the next run.
    public void enrichNotEnrichedSince(Instant enrichedBefore, int batchSize) {
        Timer.Sample runStarted = osUpdateEnrichmentMetrics.startRun();
        String tenantId = tenantIdProvider.getTenantId();
        String afterId = null;
        List<OsUpdate> staleOsUpdates;
        do {
            staleOsUpdates = osUpdateRepository.findEnrichedBefore(tenantId, enrichedBefore, afterId, batchSize);
            if (!staleOsUpdates.isEmpty()) {
                enrichBatchSafely(staleOsUpdates);
                afterId = staleOsUpdates.getLast().getId();
            }
        } while (staleOsUpdates.size() == batchSize);
        osUpdateEnrichmentMetrics.recordRun(runStarted);
    }

    // The latest security build per Windows version, from the MSRC bulletins of the month and of the one before:
    // the bulletin of the month does not exist before its Patch Tuesday. Nothing is asked while the stored builds
    // were refreshed after refreshedBefore. A stored build is never lowered, and a bulletin that cannot be read
    // leaves every stored build as it is until the next run.
    public void refreshOsVersionBuilds(YearMonth month, Instant refreshedBefore) {
        String tenantId = tenantIdProvider.getTenantId();
        List<OsVersionBuild> storedOsVersionBuilds =
                osVersionBuildRepository.findByTenantIdAndPlatform(tenantId, OsPlatform.WINDOWS);
        boolean refreshedSince = storedOsVersionBuilds.stream()
                .anyMatch(osVersionBuild -> osVersionBuild.getUpdatedAt().isAfter(refreshedBefore));
        if (refreshedSince) {
            return;
        }
        try {
            Map<String, String> latestWindowsBuilds = findLatestWindowsBuilds(month);
            osVersionBuildRepository.saveAll(
                    raiseToLatestBuilds(storedOsVersionBuilds, latestWindowsBuilds, tenantId));
        } catch (OsUpdateSourceUnavailableException failure) {
            log.warn("OS version builds of tenantId={} are not refreshed, source {} failed: {}",
                    tenantId, failure.getOsUpdateSource(), failure.getMessage());
        }
    }

    // Every version the bulletins name gets the refresh time, also when its build stays.
    private static List<OsVersionBuild> raiseToLatestBuilds(List<OsVersionBuild> storedOsVersionBuilds,
                                                            Map<String, String> latestWindowsBuilds,
                                                            String tenantId) {
        Map<String, OsVersionBuild> osVersionBuildsByOsVersion = storedOsVersionBuilds.stream()
                .collect(Collectors.toMap(OsVersionBuild::getOsVersion, Function.identity()));
        Instant updatedAt = Instant.now();
        List<OsVersionBuild> refreshedOsVersionBuilds = new ArrayList<>();
        latestWindowsBuilds.forEach((osVersion, latestBuild) -> {
            OsVersionBuild osVersionBuild = osVersionBuildsByOsVersion.computeIfAbsent(osVersion, newOsVersion ->
                    OsVersionBuild.builder()
                            .tenantId(tenantId)
                            .platform(OsPlatform.WINDOWS)
                            .osVersion(newOsVersion)
                            .latestBuild(latestBuild)
                            .build());
            if (SoftwareVersions.compare(latestBuild, osVersionBuild.getLatestBuild()) > 0) {
                osVersionBuild.setLatestBuild(latestBuild);
            }
            osVersionBuild.setUpdatedAt(updatedAt);
            refreshedOsVersionBuilds.add(osVersionBuild);
        });
        return refreshedOsVersionBuilds;
    }

    private Map<String, String> findLatestWindowsBuilds(YearMonth month) {
        Map<String, String> latestWindowsBuilds = new HashMap<>(msrcCvrfClient.getLatestWindowsBuilds(month));
        msrcCvrfClient.getLatestWindowsBuilds(month.minusMonths(1)).forEach((osVersion, latestBuild) ->
                latestWindowsBuilds.merge(osVersion, latestBuild, (first, second) ->
                        SoftwareVersions.compare(first, second) >= 0 ? first : second));
        return latestWindowsBuilds;
    }

    // WARNING: a broken batch must not end the run, or the batches after it are never reached
    private void enrichBatchSafely(List<OsUpdate> staleOsUpdates) {
        try {
            enrichBatch(staleOsUpdates);
        } catch (RuntimeException failure) {
            log.error("OS update enrichment batch from {} failed", staleOsUpdates.getFirst().getId(), failure);
            osUpdateEnrichmentMetrics.recordBatchFailed();
        }
    }

    private void enrichBatch(List<OsUpdate> staleOsUpdates) {
        Instant enrichedAt = Instant.now();
        List<OsUpdate> unclaimedOsUpdates = new ArrayList<>(staleOsUpdates);
        osUpdateEnrichers.orderedStream()
                .forEach(osUpdateEnricher -> claimAndEnrich(osUpdateEnricher, unclaimedOsUpdates, enrichedAt));
        for (OsUpdate unclaimedOsUpdate : unclaimedOsUpdates) {
            unclaimedOsUpdate.setEnrichedAt(enrichedAt);
            osUpdateEnrichmentMetrics.recordNoData(unclaimedOsUpdate.getPlatform());
        }
        staleOsUpdates.forEach(this::saveEnrichedUnlessChangedMeanwhile);
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
            osUpdateEnrichmentMetrics.recordEnricherFailed();
            osUpdates.forEach(osUpdate -> {
                if (enrichedAt.equals(osUpdate.getEnrichedAt())) {
                    osUpdate.setEnrichedAt(null);
                }
            });
        }
    }
}
