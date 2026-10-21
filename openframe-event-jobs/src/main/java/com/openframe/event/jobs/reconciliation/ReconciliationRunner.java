package com.openframe.event.jobs.reconciliation;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.persistence.EventJob;
import com.openframe.event.jobs.persistence.EventJobStatus;
import com.openframe.event.jobs.repository.ReconciledCopyRepository;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.event.jobs.service.EventJobTicker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

import static com.openframe.event.jobs.repository.ReconciledCopyRepository.TENANT_FIELD;
import static com.openframe.publishing.api.PublishedDocuments.ID_FIELD;

// Checks one tick of a run: target rows in _id batches, each batch compared with its sources and its count saved.
@Slf4j
@RequiredArgsConstructor
public class ReconciliationRunner {

    private final ReconciliationProperties properties;
    private final ReconciledCopyRepository copyRepository;
    private final EventJobService jobService;
    private final EventJobTicker ticker;
    private final ReconciliationMetrics metrics;

    public void checkBatches(MappedCopy copy, EventJob job) {
        String jobName = "Reconciliation of " + copy.getName();
        ticker.tick(jobName, job, properties, current -> checkBatch(copy, current), () -> metrics.recordFailed(copy));
    }

    private EventJob checkBatch(MappedCopy copy, EventJob job) {
        String lastId = job.getLastId();
        int batchSize = properties.getBatchSize();
        List<Document> targets = copyRepository.findTargetsAfter(copy, lastId, batchSize);
        if (targets.isEmpty()) {
            return finish(copy, job);
        }
        List<Mismatch> suspects = findMismatches(copy, targets);
        List<Mismatch> mismatches = confirm(copy, suspects);
        logMismatches(copy, mismatches);

        Document lastTarget = targets.getLast();
        Object lastTargetId = lastTarget.get(ID_FIELD);
        String batchLastId = String.valueOf(lastTargetId);
        int rows = targets.size();
        int mismatchCount = mismatches.size();
        EventJob saved = jobService.saveBatch(job, batchLastId, rows, mismatchCount);
        log.debug("Reconciliation of {} checked {} row(s), {} mismatch(es), run {}, up to {}",
                copy.getName(), rows, mismatchCount, saved.getRunId(), batchLastId);
        return saved;
    }

    // A row without a reference has nothing to copy; a reference without a source document is drift too.
    private List<Mismatch> findMismatches(MappedCopy copy, List<Document> targets) {
        Set<String> tenantIds = new TreeSet<>();
        Set<String> keys = new TreeSet<>();
        String referenceField = copy.getTargetReferenceField();
        for (Document target : targets) {
            String key = target.getString(referenceField);
            if (key != null) {
                String tenantId = target.getString(TENANT_FIELD);
                tenantIds.add(tenantId);
                keys.add(key);
            }
        }
        if (keys.isEmpty()) {
            return List.of();
        }
        Map<String, Map<String, Object>> sourceValues = copyRepository.findSourceValues(copy, tenantIds, keys);
        List<Mismatch> mismatches = new ArrayList<>();
        for (Document target : targets) {
            Mismatch mismatch = mismatchOf(copy, target, sourceValues);
            if (mismatch != null) {
                mismatches.add(mismatch);
            }
        }
        return mismatches;
    }

    private static Mismatch mismatchOf(MappedCopy copy, Document target, Map<String, Map<String, Object>> sourceValues) {
        String referenceField = copy.getTargetReferenceField();
        String key = target.getString(referenceField);
        if (key == null) {
            return null;
        }
        String tenantId = target.getString(TENANT_FIELD);
        Object targetId = target.get(ID_FIELD);
        String id = String.valueOf(targetId);
        Map<String, Object> tenantSources = sourceValues.get(tenantId);
        if (tenantSources == null || !tenantSources.containsKey(key)) {
            return new Mismatch(tenantId, id, true);
        }
        Object sourceValue = tenantSources.get(key);
        Object expected = copy.getExpectedCopy().apply(sourceValue);
        String copiedField = copy.getTargetField();
        Object actual = target.get(copiedField);
        return Objects.equals(expected, actual) ? null : new Mismatch(tenantId, id, false);
    }

    // The suspects are read again from the primary, with their sources, so a copy updated meanwhile is not counted.
    private List<Mismatch> confirm(MappedCopy copy, List<Mismatch> suspects) {
        if (suspects.isEmpty()) {
            return suspects;
        }
        List<String> ids = suspects.stream().map(Mismatch::getId).toList();
        List<Document> current = copyRepository.findTargetsByIds(copy, ids);
        return findMismatches(copy, current);
    }

    private void logMismatches(MappedCopy copy, List<Mismatch> mismatches) {
        Map<String, List<Mismatch>> byTenant = new LinkedHashMap<>();
        for (Mismatch mismatch : mismatches) {
            String tenantId = mismatch.getTenantId();
            byTenant.computeIfAbsent(tenantId, tenant -> new ArrayList<>()).add(mismatch);
        }
        int sampleSize = properties.getSampleSize();
        byTenant.forEach((tenantId, tenantMismatches) -> {
            List<String> wrongCopies = tenantMismatches.stream().filter(mismatch -> !mismatch.isMissingSource())
                    .map(Mismatch::getId).toList();
            List<String> missingSources = tenantMismatches.stream().filter(Mismatch::isMissingSource)
                    .map(Mismatch::getId).toList();
            List<String> wrongSample = wrongCopies.stream().limit(sampleSize).toList();
            List<String> missingSample = missingSources.stream().limit(sampleSize).toList();
            log.error("Reconciliation of {} in tenant {}: {} wrong copy(ies), for example {}; {} missing source(s), for example {}",
                    copy.getName(), tenantId, wrongCopies.size(), wrongSample, missingSources.size(), missingSample);
        });
    }

    // A run that checked nothing usually means a wrong collection name, so it is not reported as a clean result in silence.
    private EventJob finish(MappedCopy copy, EventJob job) {
        EventJob finished = jobService.finishRun(job, EventJobStatus.DONE);
        if (finished.getProcessed() == 0) {
            boolean targetExists = copyRepository.targetCollectionExists(copy);
            if (targetExists) {
                log.warn("Reconciliation of {} checked no rows: {} is empty", copy.getName(), copy.getTargetCollection());
            } else {
                log.error("Reconciliation of {} checked no rows: collection {} does not exist; check the copy's names",
                        copy.getName(), copy.getTargetCollection());
            }
        }
        log.info("Reconciliation of {} done, run {}: {} mismatch(es)", copy.getName(), finished.getRunId(),
                finished.getLastMismatches());
        return finished;
    }
}
