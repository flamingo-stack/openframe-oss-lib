package com.openframe.processing.listener;

import com.openframe.data.repository.organization.publishing.OrganizationEvent;
import com.openframe.processing.runner.EventProcessorRunner;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;

import static com.openframe.processing.config.EventProcessingKafkaAutoConfiguration.PROCESSING_CONTAINER_FACTORY;

// The listener of <topic-prefix>organizations; it runs whenever event processing is on, and processors on aspect skip its events.
@Slf4j
@RequiredArgsConstructor
public class OrganizationEventListener implements AggregateEventListener {

    // No defaults: a service that turns processing on must name its topics and its own group.
    static final String TOPIC_PREFIX = "${openframe.events.processing.kafka.topic-prefix}";
    static final String GROUP_PREFIX = "${openframe.events.processing.kafka.group-prefix}";

    private final EventProcessorRunner runner;

    @Override
    public PublishedAggregateType getType() {
        return PublishedAggregateType.ORGANIZATIONS;
    }

    // The Kafka key is the outbox aggregateId: the organization document's Mongo _id, not its organizationId.
    @KafkaListener(
            topics = TOPIC_PREFIX + "organizations",
            groupId = GROUP_PREFIX + "organizations",
            containerFactory = PROCESSING_CONTAINER_FACTORY)
    public void onOrganization(@Header(KafkaHeaders.RECEIVED_KEY) String aggregateId,
                               @Payload(required = false) PublishedRecord<OrganizationEvent> envelope) {
        // A tombstone after a delete: nothing to apply, compaction needs it only to remove the key.
        if (envelope == null) {
            log.debug("Tombstone of {} {} skipped", getType().getName(), aggregateId);
            return;
        }
        PublishedAggregateType type = getType();
        runner.process(type, aggregateId, envelope);
    }
}
