package com.openframe.stream.listener;

import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.stream.processor.GenericJsonMessageProcessor;
    import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

/**
 * Tenant-cluster consumer fan-in for all integrated-tool Debezium events.
 * Activated only when the tenant Kafka cluster is configured (the property
 * keys this {@code @KafkaListener} references would otherwise fail placeholder
 * resolution). Shared SaaS deployments use {@code SharedMeshCentralKafkaListener}.
 */
@Service
@ConditionalOnProperty(name = "openframe.cluster.mode", havingValue = "tenant", matchIfMissing = true)
public class JsonKafkaListener {

    private final GenericJsonMessageProcessor messageProcessor;

    public JsonKafkaListener(GenericJsonMessageProcessor messageProcessor) {
        this.messageProcessor = messageProcessor;
    }

    @KafkaListener(
            topics = {
                    "${openframe.oss-tenant.kafka.topics.inbound.meshcentral-events.name}",
                    "${openframe.oss-tenant.kafka.topics.inbound.tactical-rmm-events.name}",
                    "${openframe.oss-tenant.kafka.topics.inbound.tactical-rmm-task-result-events.name}",
                    "${openframe.oss-tenant.kafka.topics.inbound.fleet-mdm-events.name}",
                    "${openframe.oss-tenant.kafka.topics.inbound.fleet-mdm-query-result-events.name}",
                    "${openframe.oss-tenant.kafka.topics.inbound.fleet-mdm-policy-membership-events.name}"
            },
            groupId = "${spring.oss-tenant.kafka.consumer.group-id}"
    )
    public void listenIntegratedToolsEvents(@Payload CommonDebeziumMessage debeziumMessage, @Header(KafkaHeader.MESSAGE_TYPE_HEADER) MessageType messageType) {
        messageProcessor.process(debeziumMessage, messageType);
    }
}
