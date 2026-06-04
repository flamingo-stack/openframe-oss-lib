package com.openframe.client.service;

import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.kafka.model.CommandResultEvent;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;

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

    @Value("${openframe.oss-tenant.kafka.topics.outbound.command-results-topic}")
    private String commandResultsTopic;

    public void processCommandResult(String machineId, CommandResultMessage message) {
        CommandResultEvent event = new CommandResultEvent();
        event.setMachineId(machineId);
        event.setExecutionId(message.getExecutionId());
        event.setStatus(message.getStatus());
        event.setResult(message.getResult());
        event.setEventTimestamp(Instant.now().toEpochMilli());

        kafkaProducer.publish(commandResultsTopic, machineId, event);

        log.info("Published command result to Kafka: topic={} machineId={} executionId={} status={}",
                commandResultsTopic, machineId, event.getExecutionId(), event.getStatus());
    }
}
