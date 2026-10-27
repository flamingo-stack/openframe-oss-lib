package com.openframe.event.jobs.reconciliation.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.repository.ProjectedItemRepository;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import com.openframe.publishing.registry.PublishedAggregates;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

// Checks one tick of a run: projected items in _id batches, each reconciled, its mismatches repaired and its count saved.
@Slf4j
@RequiredArgsConstructor
public class ReconciliationRunner {

    private static final Duration REPUBLISHED_SOURCES_TTL = Duration.ofHours(1);

    private final ReconciliationProperties properties;
    private final ProjectedItemRepository itemRepository;
    private final EventJobService jobService;
    private final EventJobTicker ticker;
    private final ReconciliationMetrics metrics;
    private final AggregateSpecRegistry specRegistry;
    private final PublishedAggregates publishedAggregates;
    // Per projection and run: each source is published again once per run; expires an hour after the pod's last batch.
    private final Cache<String, RunSources> republishedSources = Caffeine.newBuilder()
            .expireAfterAccess(REPUBLISHED_SOURCES_TTL)
            .build();

    public void checkBatches(Projection<?, ?> projection, EventJob job) {
        String jobName = "Reconciliation of " + projection.name();
        ticker.tick(jobName, job, properties, current -> checkBatch(projection, current), () -> metrics.recordFailed(projection));
    }

    private <T> EventJob checkBatch(Projection<?, T> projection, EventJob job) {
        Class<?> projectedClass = projection.projectedClass();
        Class<T> projectedViewClass = projection.projectedViewClass();
        String lastId = job.getLastId();
        int batchSize = properties.getBatchSize();
        List<T> projectedItems = itemRepository.findAfter(projectedClass, projectedViewClass, lastId, batchSize);
        if (projectedItems.isEmpty()) {
            return finish(projection, job);
        }
        ReconciliationResult result = projection.reconcile(projectedItems);
        List<Mismatch> suspects = result.getMismatches();
        List<Mismatch> mismatches = confirm(projection, suspects);
        logMismatches(projection, mismatches);
        republishSources(projection, job, mismatches);

        T lastItem = projectedItems.getLast();
        String batchLastId = itemRepository.resolveId(lastItem);
        int items = projectedItems.size();
        int mismatchCount = mismatches.size();
        EventJob saved = jobService.saveBatch(job, batchLastId, items, mismatchCount);
        log.debug("Reconciliation of {} checked {} item(s), {} mismatch(es), run {}, up to {}",
                projection.name(), items, mismatchCount, saved.getRunId(), batchLastId);
        return saved;
    }

    // The suspects are read again from the primary and reconciled again, so an item updated meanwhile is not counted.
    private <T> List<Mismatch> confirm(Projection<?, T> projection, List<Mismatch> suspects) {
        if (suspects.isEmpty()) {
            return suspects;
        }
        Class<?> projectedClass = projection.projectedClass();
        Class<T> projectedViewClass = projection.projectedViewClass();
        List<String> ids = suspects.stream().map(Mismatch::getProjectedItemId).toList();
        List<T> current = itemRepository.findByIds(projectedClass, projectedViewClass, ids);
        ReconciliationResult confirmed = projection.reconcile(current);
        return confirmed.getMismatches();
    }

    // The repair: the sources are published again, and the projection applies them, as an equal version passes.
    private void republishSources(Projection<?, ?> projection, EventJob job, List<Mismatch> mismatches) {
        List<String> mismatchedSourceIds = mismatches.stream()
                .filter(mismatch -> !mismatch.isSourceGone())
                .map(Mismatch::getSourceId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        List<String> sourceIds = keepNotRepublished(projection, job, mismatchedSourceIds);
        if (sourceIds.isEmpty()) {
            return;
        }
        String type = specRegistry.resolveType(projection);
        publishedAggregates.publishCurrent(type, sourceIds);
        log.info("Reconciliation of {} published {} {} source(s) again to repair them", projection.name(), sourceIds.size(), type);
    }

    private List<String> keepNotRepublished(Projection<?, ?> projection, EventJob job, List<String> sourceIds) {
        String projectionName = projection.name();
        String runId = job.getRunId();
        RunSources run = republishedSources.asMap().compute(projectionName,
                (name, current) -> current != null && current.isForRun(runId) ? current : new RunSources(runId));
        return run.addNew(sourceIds);
    }

    private void logMismatches(Projection<?, ?> projection, List<Mismatch> mismatches) {
        Map<String, List<Mismatch>> byTenant = new LinkedHashMap<>();
        for (Mismatch mismatch : mismatches) {
            String tenantId = mismatch.getTenantId();
            byTenant.computeIfAbsent(tenantId, tenant -> new ArrayList<>()).add(mismatch);
        }
        int sampleSize = properties.getSampleSize();
        byTenant.forEach((tenantId, tenantMismatches) -> {
            List<String> sample = tenantMismatches.stream().limit(sampleSize).map(ReconciliationRunner::describe).toList();
            log.error("Reconciliation of {} in tenant {}: {} mismatch(es), for example {}",
                    projection.name(), tenantId, tenantMismatches.size(), sample);
        });
    }

    private static String describe(Mismatch mismatch) {
        return mismatch.getProjectedItemId() + ": " + mismatch.getReason();
    }

    // A run that checked nothing is not reported as a clean result in silence.
    private EventJob finish(Projection<?, ?> projection, EventJob job) {
        EventJob finished = jobService.finishRun(job, EventJobStatus.DONE);
        String projectionName = projection.name();
        republishedSources.invalidate(projectionName);
        if (finished.getProcessed() == 0) {
            Class<?> projectedClass = projection.projectedClass();
            boolean collectionExists = itemRepository.collectionExists(projectedClass);
            if (collectionExists) {
                log.warn("Reconciliation of {} checked no items: the collection of {} is empty",
                        projection.name(), projectedClass.getSimpleName());
            } else {
                log.error("Reconciliation of {} checked no items: the collection of {} does not exist",
                        projection.name(), projectedClass.getSimpleName());
            }
        }
        log.info("Reconciliation of {} done, run {}: {} mismatch(es)", projection.name(), finished.getRunId(),
                finished.getLastMismatches());
        return finished;
    }

    @RequiredArgsConstructor
    private static class RunSources {

        private final String runId;
        private final Set<String> published = new HashSet<>();

        boolean isForRun(String otherRunId) {
            return runId.equals(otherRunId);
        }

        List<String> addNew(List<String> sourceIds) {
            return sourceIds.stream().filter(published::add).toList();
        }
    }
}
