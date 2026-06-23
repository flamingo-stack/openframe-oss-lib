package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Optional;

/**
 * Base deserializer for OpenFrame native RMM execution results — a command or a
 * saved script — published by the client-service.
 *
 * <p>The inbound Debezium {@code after} mirrors the agent's execution-result
 * struct (camelCase keys produced by {@code RmmResultEvent}): {@code machineId},
 * {@code executionId}, {@code stdout}, {@code stderr}, {@code exitCode},
 * {@code executionTimeMs}, {@code timedOut}, {@code error},
 * {@code eventTimestamp}.
 *
 * <p>Command and script results are structurally identical and share all the
 * extraction logic here; the concrete subclass differs only in the
 * {@code MessageType} it is bound to ({@code COMMAND_EXECUTED} /
 * {@code SCRIPT_EXECUTED}) — that routing key is what lets downstream tell a
 * command result from a script result.
 */
@Slf4j
public abstract class RmmResultDeserializer extends IntegratedToolEventDeserializer {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_EXECUTION_TIME_MS = "executionTimeMs";
    private static final String FIELD_TIMED_OUT = "timedOut";
    private static final String FIELD_ERROR = "error";
    private static final String FIELD_EVENT_TIMESTAMP = "eventTimestamp";

    private static final String DETAILS_OUTPUT = "output";
    private static final String DETAILS_EXIT_CODE = "exit_code";
    private static final String DETAILS_EXECUTION_TIME_MS = "execution_time_ms";
    private static final String DETAILS_TIMED_OUT = "timed_out";
    private static final String DETAILS_ERROR = "error";

    protected RmmResultDeserializer(ObjectMapper mapper) {
        super(mapper, List.of(), List.of());
    }

    @Override
    protected Optional<String> getTenantId(JsonNode after) {
        return parseStringField(after, FIELD_TENANT_ID);
    }

    @Override
    protected Optional<String> getAgentId(JsonNode after) {
        return parseStringField(after, FIELD_MACHINE_ID);
    }

    @Override
    protected abstract Optional<String> getSourceEventType(JsonNode after);

    @Override
    protected Optional<String> getEventToolId(JsonNode after) {
        String executionId = parseStringField(after, FIELD_EXECUTION_ID).orElse(null);
        String machineId = parseStringField(after, FIELD_MACHINE_ID).orElse(null);
        if (executionId == null && machineId == null) {
            return Optional.empty();
        }
        return Optional.of(String.join(":",
                executionId == null ? "" : executionId,
                machineId == null ? "" : machineId));
    }

    @Override
    protected Optional<String> getMessage(JsonNode after) {
        boolean timedOut = parseStringField(after, FIELD_TIMED_OUT).map(Boolean::parseBoolean).orElse(false);
        if (timedOut) {
            return Optional.of("Command timed out");
        }
        return parseStringField(after, FIELD_EXIT_CODE)
                .map(code -> "Command finished (exit code %s)".formatted(code))
                .or(() -> Optional.of("Command finished"));
    }

    @Override
    protected Optional<Long> getSourceEventTimestamp(JsonNode after) {
        return parseStringField(after, FIELD_EVENT_TIMESTAMP).map(Long::parseLong);
    }

    @Override
    protected String getResult(JsonNode after) {
        try {
            ObjectNode result = mapper.createObjectNode();
            parseStringField(after, FIELD_STDOUT).ifPresent(out -> result.put(DETAILS_OUTPUT, out));
            parseStringField(after, FIELD_EXIT_CODE)
                    .ifPresent(rc -> putIntOrString(result, DETAILS_EXIT_CODE, rc));
            parseStringField(after, FIELD_EXECUTION_TIME_MS)
                    .ifPresent(ms -> putLongOrString(result, DETAILS_EXECUTION_TIME_MS, ms));
            if (result.isEmpty()) {
                return null;
            }
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("Failed to build result JSON for command result", e);
            return null;
        }
    }

    @Override
    protected String getError(JsonNode after) {
        boolean timedOut = parseStringField(after, FIELD_TIMED_OUT).map(Boolean::parseBoolean).orElse(false);
        boolean failed = parseStringField(after, FIELD_EXIT_CODE)
                .map(rc -> {
                    try {
                        return Integer.parseInt(rc) != 0;
                    } catch (NumberFormatException e) {
                        return false;
                    }
                }).orElse(false);
        Optional<String> stderr = parseStringField(after, FIELD_STDERR);
        Optional<String> error = parseStringField(after, FIELD_ERROR);

        if (!timedOut && !failed && stderr.isEmpty() && error.isEmpty()) {
            return null;
        }
        try {
            ObjectNode errorNode = mapper.createObjectNode();
            stderr.ifPresent(s -> errorNode.put(DETAILS_OUTPUT, s));
            error.ifPresent(e -> errorNode.put(DETAILS_ERROR, e));
            parseStringField(after, FIELD_EXIT_CODE)
                    .ifPresent(rc -> putIntOrString(errorNode, DETAILS_EXIT_CODE, rc));
            if (timedOut) {
                errorNode.put(DETAILS_TIMED_OUT, true);
            }
            return mapper.writeValueAsString(errorNode);
        } catch (Exception e) {
            log.error("Failed to build error JSON for command result", e);
            return null;
        }
    }

    @Override
    protected String getDetails(JsonNode after) {
        try {
            ObjectNode details = mapper.createObjectNode();
            parseStringField(after, FIELD_EXIT_CODE)
                    .ifPresent(rc -> putIntOrString(details, DETAILS_EXIT_CODE, rc));
            parseStringField(after, FIELD_EXECUTION_TIME_MS)
                    .ifPresent(ms -> putLongOrString(details, DETAILS_EXECUTION_TIME_MS, ms));
            parseStringField(after, FIELD_TIMED_OUT)
                    .ifPresent(t -> details.put(DETAILS_TIMED_OUT, Boolean.parseBoolean(t)));
            if (details.isEmpty()) {
                return null;
            }
            return mapper.writeValueAsString(details);
        } catch (Exception e) {
            log.error("Failed to build details JSON for command result", e);
            return null;
        }
    }

    private static void putIntOrString(ObjectNode node, String key, String value) {
        try {
            node.put(key, Integer.parseInt(value));
        } catch (NumberFormatException e) {
            node.put(key, value);
        }
    }

    private static void putLongOrString(ObjectNode node, String key, String value) {
        try {
            node.put(key, Long.parseLong(value));
        } catch (NumberFormatException e) {
            node.put(key, value);
        }
    }
}
