package com.openframe.stream.listener;

import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.stream.processor.GenericJsonMessageProcessor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

/**
 * Consumes OpenFrame native RMM command-execution results published by the
 * client-service on the {@code command-results} topic and routes them through
 * the shared {@link GenericJsonMessageProcessor} pipeline (deserialize →
 * enrich → Cassandra/Pinot), reusing {@link MessageType#RMM}.
 *
 * <p>Unlike {@link JsonKafkaListener}, this topic is single-type and the
 * producer does not set the {@code message-type} header, so the type is fixed
 * here rather than read from a header.
 */
@Service
@ConditionalOnProperty(name = "openframe.cluster.mode", havingValue = "tenant", matchIfMissing = true)
public class CommandResultKafkaListener {

    private final GenericJsonMessageProcessor messageProcessor;

    public CommandResultKafkaListener(GenericJsonMessageProcessor messageProcessor) {
        this.messageProcessor = messageProcessor;
    }

    @KafkaListener(
            topics = "${openframe.oss-tenant.kafka.topics.inbound.rmm-command-events.name}",
            groupId = "${spring.oss-tenant.kafka.consumer.group-id}"
    )
    public void listenCommandResults(@Payload CommonDebeziumMessage debeziumMessage) {
        messageProcessor.process(debeziumMessage, MessageType.RMM);
    }
}
