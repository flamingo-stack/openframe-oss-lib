package com.openframe.event.jobs.task.service;

import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.Map;

// A task's envelope: written like the outbox payload, read back into its spec's event class like a Kafka record.
public class ProjectionTaskEnvelopes {

    private static final TypeReference<Map<String, Object>> ENVELOPE_TYPE = new TypeReference<>() {
    };

    // Unknown fields are skipped: a task saved by a newer build may still be read by an older pod during a rollout.
    private static final JsonMapper ENVELOPE_MAPPER = JsonMapper.builder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final Map<String, JavaType> recordTypesByType;

    public ProjectionTaskEnvelopes(AggregateSpecRegistry specRegistry) {
        Map<String, JavaType> recordTypes = new HashMap<>();
        for (AggregateSpec<?, ?> spec : specRegistry.specs()) {
            String type = spec.getType();
            Class<?> eventClass = PublishedDocuments.resolveEventClass(spec);
            JavaType recordType = ENVELOPE_MAPPER.getTypeFactory().constructParametricType(PublishedRecord.class, eventClass);
            recordTypes.put(type, recordType);
        }
        this.recordTypesByType = Map.copyOf(recordTypes);
    }

    public Map<String, Object> toEnvelope(PublishedRecord<?> record) {
        return ENVELOPE_MAPPER.convertValue(record, ENVELOPE_TYPE);
    }

    public PublishedRecord<?> toRecord(ProjectionTask task) {
        String type = task.getType();
        JavaType recordType = recordTypesByType.get(type);
        if (recordType == null) {
            throw new IllegalStateException("No published aggregate spec for " + type + " of the projection task " + task.getId());
        }
        Map<String, Object> envelope = task.getEnvelope();
        return ENVELOPE_MAPPER.convertValue(envelope, recordType);
    }
}
