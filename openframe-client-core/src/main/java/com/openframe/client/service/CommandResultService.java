package com.openframe.client.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.CommandResultEvent;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/**
 * Transforms a command-result message received from the agent over core NATS
 * into a {@link CommandResultEvent} and publishes it to Kafka. Downstream
 * processing (enrichment / persistence) is the stream-service's responsibility
 * and is intentionally out of scope here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CommandResultService {

    private final OssTenantRetryingKafkaProducer kafkaProducer;
    private final ObjectMapper objectMapper;

    @Value("${openframe.oss-tenant.kafka.topics.outbound.rmm-topic}")
    private String commandResultsTopic;

    public void processCommandResult(String machineId, CommandResultMessage message) {
        long now = Instant.now().toEpochMilli();

        CommandResultEvent data = new CommandResultEvent();
        data.setMachineId(machineId);
        data.setExecutionId(message.getExecutionId());
        data.setStdout(message.getStdout());
        data.setStderr(message.getStderr());
        data.setExitCode(message.getExitCode());
        data.setExecutionTimeMs(message.getExecutionTimeMs());
        data.setTimedOut(message.getTimedOut());
        data.setError(message.getError());
        data.setEventTimestamp(now);

        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(objectMapper.valueToTree(data));
        payload.setOperation("c");
        payload.setTimestamp(now);

        CommonDebeziumMessage event = new CommonDebeziumMessage();
        event.setPayload(payload);

        Map<String, Object> headers = Map.of(KafkaHeader.MESSAGE_TYPE_HEADER, MessageType.RMM.name());
        kafkaProducer.publish(commandResultsTopic, machineId, event, headers);

        log.info("Published command result to Kafka: topic={} machineId={} executionId={} exitCode={} timedOut={}",
                commandResultsTopic, machineId, data.getExecutionId(), data.getExitCode(), data.getTimedOut());
    }
}
