package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.cassandra.model.CommandResult;
import com.openframe.data.cassandra.repository.CommandResultRepository;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnClass(CassandraRepository.class)
@ConditionalOnProperty(name = "spring.data.cassandra.enabled", havingValue = "true")
public class CommandResultCassandraMessageHandler
        implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_EXECUTION_TIME_MS = "executionTimeMs";
    private static final String FIELD_TIMED_OUT = "timedOut";
    private static final String FIELD_ERROR = "error";

    private final CommandResultRepository commandResultRepository;
    private final ObjectMapper mapper;

    public CommandResultCassandraMessageHandler(
            CommandResultRepository commandResultRepository,
            ObjectMapper mapper) {
        this.commandResultRepository = commandResultRepository;
        this.mapper = mapper;
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.CASSANDRA_COMMAND_RESULT;
    }

    @Override
    public void handle(DeserializedDebeziumMessage message, IntegratedToolEnrichedData extraParams) {
        JsonNode after = message.getPayload() == null ? null : message.getPayload().getAfter();
        if (after == null || after.isNull()) {
            return;
        }

        String executionId = text(after, FIELD_EXECUTION_ID);
        String machineId = text(after, FIELD_MACHINE_ID);
        if (executionId == null || machineId == null) {
            log.warn("Command result missing executionId/machineId — skipping command_results write");
            return;
        }

        CommandResult row = new CommandResult();
        row.setKey(new CommandResult.CommandResultKey(executionId, machineId));
        row.setResult(buildResultJson(after));

        // The command_results table has a table-level default_time_to_live, so a
        // plain save self-expires — no per-write TTL needed.
        commandResultRepository.save(row);
        log.info("Stored command result executionId={} machineId={}", executionId, machineId);
    }

    /** Pack exactly the agent's result fields into one JSON string. */
    private String buildResultJson(JsonNode after) {
        ObjectNode result = mapper.createObjectNode();
        putText(result, after, FIELD_EXECUTION_ID);
        putText(result, after, FIELD_MACHINE_ID);
        putText(result, after, FIELD_STDOUT);
        putText(result, after, FIELD_STDERR);
        putInt(result, after, FIELD_EXIT_CODE);
        putLong(result, after, FIELD_EXECUTION_TIME_MS);
        putBool(result, after, FIELD_TIMED_OUT);
        putText(result, after, FIELD_ERROR);
        try {
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Failed to serialize command result JSON for executionId={}",
                    text(after, FIELD_EXECUTION_ID), e);
            return null;
        }
    }

    private static String text(JsonNode after, String field) {
        JsonNode node = after.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }

    private static void putText(ObjectNode out, JsonNode after, String field) {
        JsonNode node = after.get(field);
        if (node != null && !node.isNull()) {
            out.put(field, node.asText());
        }
    }

    private static void putInt(ObjectNode out, JsonNode after, String field) {
        JsonNode node = after.get(field);
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isNumber()) {
            out.put(field, node.intValue());
            return;
        }
        try {
            out.put(field, Integer.parseInt(node.asText().trim()));
        } catch (NumberFormatException e) {
            out.put(field, node.asText());
        }
    }

    private static void putLong(ObjectNode out, JsonNode after, String field) {
        JsonNode node = after.get(field);
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isNumber()) {
            out.put(field, node.longValue());
            return;
        }
        try {
            out.put(field, Long.parseLong(node.asText().trim()));
        } catch (NumberFormatException e) {
            out.put(field, node.asText());
        }
    }

    private static void putBool(ObjectNode out, JsonNode after, String field) {
        JsonNode node = after.get(field);
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isBoolean()) {
            out.put(field, node.booleanValue());
            return;
        }
        out.put(field, Boolean.parseBoolean(node.asText().trim()));
    }
}
