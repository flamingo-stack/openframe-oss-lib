package com.openframe.client.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.publisher.EventLogsPublisher;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.nats.rmm.model.RmmResultMessage;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.RmmResultEvent;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/**
 * Transforms an RMM execution-result message (a command or a saved script)
 * received from the agent over core NATS into a {@link RmmResultEvent} and
 * publishes it to Kafka. Downstream processing (enrichment / persistence) is
 * the stream-service's responsibility and is intentionally out of scope here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RmmResultService {

    private final EventLogsPublisher eventLogsPublisher;
    private final TenantIdProvider tenantIdProvider;
    private final ObjectMapper objectMapper;

    public void processResult(String machineId, RmmResultMessage message) {
        long now = Instant.now().toEpochMilli();

        RmmResultEvent data = getRmmResultEvent(machineId, message, now);
        CommonDebeziumMessage event = toDebeziumMessage(data, now);

        Map<String, Object> headers = Map.of(KafkaHeader.MESSAGE_TYPE_HEADER, MessageType.RMM.name());
        eventLogsPublisher.publish(machineId, event, headers);

        log.info("Published RMM result to Kafka: tenantId={} machineId={} executionId={} exitCode={} timedOut={}",
                data.getTenantId(), machineId, data.getExecutionId(), data.getExitCode(), data.getTimedOut());
    }

    @NotNull
    private RmmResultEvent getRmmResultEvent(String machineId, RmmResultMessage message, long now) {
        RmmResultEvent data = new RmmResultEvent();
        data.setTenantId(tenantIdProvider.getTenantId());
        data.setMachineId(machineId);
        data.setExecutionId(message.getExecutionId());
        data.setStdout(message.getStdout());
        data.setStderr(message.getStderr());
        data.setExitCode(message.getExitCode());
        data.setExecutionTimeMs(message.getExecutionTimeMs());
        data.setTimedOut(message.getTimedOut());
        data.setError(message.getError());
        data.setEventTimestamp(now);
        return data;
    }

    @NotNull
    private CommonDebeziumMessage toDebeziumMessage(RmmResultEvent data, long now) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(objectMapper.valueToTree(data));
        payload.setOperation("c");
        payload.setTimestamp(now);

        CommonDebeziumMessage event = new CommonDebeziumMessage();
        event.setPayload(payload);
        return event;
    }
}
