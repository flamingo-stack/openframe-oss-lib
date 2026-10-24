package com.openframe.processing.listener;

import com.openframe.processing.runner.ProjectionRunner;
import com.openframe.publishing.api.model.PublishedRecord;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.listener.MessageListener;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

// Reads one published type's records into its spec's event class and passes them to the runner.
@Slf4j
public class PublishedTypeListener implements MessageListener<String, byte[]> {

    private final String type;
    private final JsonMapper envelopeMapper;
    private final JavaType recordType;
    private final ProjectionRunner runner;

    public PublishedTypeListener(String type,
                                 Class<?> eventClass,
                                 JsonMapper envelopeMapper,
                                 ProjectionRunner runner) {
        this.type = type;
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
            log.debug("Tombstone of {} {} skipped", type, aggregateId);
            return;
        }
        PublishedRecord<?> envelope = envelopeMapper.readValue(value, recordType);
        runner.process(type, aggregateId, envelope);
    }
}
