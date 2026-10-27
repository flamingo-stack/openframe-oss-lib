package com.openframe.processing.listener;

import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.model.PublishedRecord;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.listener.MessageListener;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

// Reads one published type's records into its spec's event class and passes them to the runner for one projection.
@Slf4j
public class ProjectionListener implements MessageListener<String, byte[]> {

    private final String type;
    private final Projection<?, ?> projection;
    private final JsonMapper envelopeMapper;
    private final JavaType recordType;
    private final ProjectionRunner runner;

    public ProjectionListener(String type,
                              Projection<?, ?> projection,
                              Class<?> eventClass,
                              JsonMapper envelopeMapper,
                              ProjectionRunner runner) {
        this.type = type;
        this.projection = projection;
        this.envelopeMapper = envelopeMapper;
        this.recordType = envelopeMapper.getTypeFactory().constructParametricType(PublishedRecord.class, eventClass);
        this.runner = runner;
    }

    // The Kafka key is the outbox aggregateId: the document's Mongo _id, not, for example, its organizationId.
    @Override
    public void onMessage(ConsumerRecord<String, byte[]> record) {
        String aggregateId = record.key();
        byte[] value = record.value();
        // A tombstone after a delete: nothing to apply, compaction needs it only to remove the key.
        if (value == null) {
            log.debug("Tombstone of {} {} skipped by {}", type, aggregateId, projection.name());
            return;
        }
        PublishedRecord<?> envelope = envelopeMapper.readValue(value, recordType);
        runner.process(type, projection, aggregateId, envelope);
    }
}
