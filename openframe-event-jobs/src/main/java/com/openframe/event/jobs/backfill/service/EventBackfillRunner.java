package com.openframe.event.jobs.backfill.service;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.publishing.registry.PublishedAggregates;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

// Writes one tick of a run: _id batches of the type's documents to the outbox, each followed by its saved progress.
@Slf4j
@RequiredArgsConstructor
public class EventBackfillRunner {

    // A document rewritten this often during one batch is left to its own writes, which publish it anyway.
    private static final int MAX_REPUBLISHES = 5;

    private final EventBackfillProperties properties;
    private final PublishedAggregates publishedAggregates;
    private final EventJobService jobService;
    private final EventJobTicker ticker;
    private final EventBackfillMetrics metrics;

    public void writeBatches(String type, EventJob job) {
        String jobName = "Backfill of " + type;
        ticker.tick(jobName, job, properties, current -> writeBatch(type, current), () -> metrics.recordFailed(type));
    }

    private EventJob writeBatch(String type, EventJob job) {
        String fromId = job.getLastId();
        int batchSize = properties.getBatchSize();
        List<String> ids = publishedAggregates.idsAfter(type, fromId, batchSize);
        if (ids.isEmpty()) {
            EventJob done = jobService.finishRun(job, EventJobStatus.DONE);
            log.info("Backfill of {} done, run {}, last id {}", type, done.getRunId(), done.getLastId());
            return done;
        }
        Map<String, Long> published = publishedAggregates.publishCurrent(type, ids);
        republishChanged(type, published);

        String lastId = ids.getLast();
        int written = ids.size();
        EventJob saved = jobService.saveBatch(job, lastId, written, 0);
        metrics.recordDocuments(type, written);
        log.debug("Backfill of {} wrote {} document(s), run {}, up to {}", type, written, saved.getRunId(), lastId);
        return saved;
    }

    // A write committed while the batch was read lands on the topic before it, and compaction keeps the batch's older row.
    private void republishChanged(String type, Map<String, Long> published) {
        Map<String, Long> lastPublished = published;
        for (int attempt = 0; attempt < MAX_REPUBLISHES; attempt++) {
            List<String> changed = publishedAggregates.changedSince(type, lastPublished);
            if (changed.isEmpty()) {
                return;
            }
            log.debug("Backfill of {} publishes {} document(s) again, written during the batch", type, changed.size());
            lastPublished = publishedAggregates.publishCurrent(type, changed);
        }
        log.warn("Backfill of {}: documents kept changing during the batch; their own writes publish them", type);
    }
}
