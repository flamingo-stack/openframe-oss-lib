package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.model.enums.MessageType;
import com.openframe.stream.service.TacticalRmmCacheService;
import com.openframe.stream.util.TimestampParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@Slf4j
public class TrmmTaskResultEventDeserializer extends IntegratedToolEventDeserializer {

    // Field name constants for autotasks_taskresult table
    private static final String FIELD_ID = "id";
    private static final String FIELD_AGENT_ID = "agent_id";
    private static final String FIELD_TASK_ID = "task_id";
    private static final String FIELD_RETCODE = "retcode";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_EXECUTION_TIME = "execution_time";
    private static final String FIELD_LAST_RUN = "last_run";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_SYNC_STATUS = "sync_status";
    private static final String FIELD_RUN_STATUS = "run_status";

    // Details field constants
    private static final String DETAILS_OUTPUT = "output";
    private static final String DETAILS_EXECUTION_TIME = "execution_time";
    private static final String DETAILS_RETCODE = "retcode";
    private static final String DETAILS_TASK_ID = "task_id";

    // Source event type patterns
    private static final String TASK_RESULT_COMPLETED = "task_result.completed";
    private static final String TASK_RESULT_FAILING = "task_result.failing";
    private static final String TASK_RESULT_PENDING = "task_result.pending";

    private final TacticalRmmCacheService tacticalRmmCacheService;

    protected TrmmTaskResultEventDeserializer(ObjectMapper mapper, TacticalRmmCacheService tacticalRmmCacheService) {
        super(mapper, List.of(), List.of());
        this.tacticalRmmCacheService = tacticalRmmCacheService;
    }

    @Override
    public MessageType getType() {
        return MessageType.TACTICAL_RMM_TASK_RESULT_EVENT;
    }

    @Override
    protected Optional<String> getAgentId(JsonNode after) {
        try {
            Integer agentPkId = parseStringField(after, FIELD_AGENT_ID)
                    .map(Integer::parseInt)
                    .orElse(null);
            if (agentPkId == null) {
                log.error("Agent id is null in task result event");
                return Optional.empty();
            }
            return Optional.ofNullable(tacticalRmmCacheService.getAgentIdByPrimaryKey(agentPkId));
        } catch (NumberFormatException e) {
            log.error("Invalid agent_id format: {}", parseStringField(after, FIELD_AGENT_ID).orElse("null"), e);
            return Optional.empty();
        }
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode after) {
        return parseStringField(after, FIELD_STATUS).map(status -> switch (status) {
            case "passing" -> TASK_RESULT_COMPLETED;
            case "failing" -> TASK_RESULT_FAILING;
            default -> "task_result.%s".formatted(status);
        });
    }

    @Override
    protected Optional<String> getEventToolId(JsonNode after) {
        return parseStringField(after, FIELD_ID);
    }

    @Override
    protected Optional<String> getMessage(JsonNode after) {
        String status = parseStringField(after, FIELD_STATUS).orElse("unknown");
        String runStatus = parseStringField(after, FIELD_RUN_STATUS).orElse("unknown");
        String taskId = parseStringField(after, FIELD_TASK_ID).orElse("unknown");
        String retcode = parseStringField(after, FIELD_RETCODE).orElse("N/A");

        return Optional.of(String.format("Task %s %s (run_status: %s, retcode: %s)",
                taskId, status, runStatus, retcode));
    }

    @Override
    protected Optional<Long> getSourceEventTimestamp(JsonNode afterField) {
        return parseStringField(afterField, FIELD_LAST_RUN)
                .flatMap(TimestampParser::parseIso8601);
    }

    @Override
    protected String getError(JsonNode after) {
        Optional<String> stderr = parseStringField(after, FIELD_STDERR);
        if (stderr.isPresent()) {
            try {
                ObjectNode errorNode = mapper.createObjectNode();
                errorNode.put(DETAILS_OUTPUT, stderr.get());
                return mapper.writeValueAsString(errorNode);
            } catch (Exception e) {
                log.error("Failed to create error JSON from stderr", e);
            }
        }

        // Also treat non-zero retcode with no stderr as potential error indicator
        Optional<String> status = parseStringField(after, FIELD_STATUS);
        if (status.isPresent() && "failing".equals(status.get())) {
            try {
                ObjectNode errorNode = mapper.createObjectNode();
                String stdout = parseStringField(after, FIELD_STDOUT).orElse("");
                errorNode.put(DETAILS_OUTPUT, stdout);
                errorNode.put(DETAILS_RETCODE, parseStringField(after, FIELD_RETCODE).orElse(""));
                return mapper.writeValueAsString(errorNode);
            } catch (Exception e) {
                log.error("Failed to create error JSON for failing task", e);
            }
        }

        return null;
    }

    @Override
    protected String getResult(JsonNode after) {
        Optional<String> stdout = parseStringField(after, FIELD_STDOUT);
        if (stdout.isPresent()) {
            try {
                ObjectNode resultNode = mapper.createObjectNode();
                resultNode.put(DETAILS_OUTPUT, stdout.get());

                parseStringField(after, FIELD_EXECUTION_TIME)
                        .ifPresent(execTime -> {
                            try {
                                resultNode.put(DETAILS_EXECUTION_TIME, Double.parseDouble(execTime));
                            } catch (NumberFormatException e) {
                                resultNode.put(DETAILS_EXECUTION_TIME, execTime);
                            }
                        });

                parseStringField(after, FIELD_RETCODE)
                        .ifPresent(rc -> {
                            try {
                                resultNode.put(DETAILS_RETCODE, Integer.parseInt(rc));
                            } catch (NumberFormatException e) {
                                resultNode.put(DETAILS_RETCODE, rc);
                            }
                        });

                parseStringField(after, FIELD_TASK_ID)
                        .ifPresent(taskId -> resultNode.put(DETAILS_TASK_ID, taskId));

                return mapper.writeValueAsString(resultNode);
            } catch (Exception e) {
                log.error("Failed to create result JSON from stdout", e);
                return stdout.get();
            }
        }
        return null;
    }

    @Override
    protected String getDetails(JsonNode after) {
        try {
            ObjectNode detailsNode = mapper.createObjectNode();

            parseStringField(after, FIELD_SYNC_STATUS)
                    .ifPresent(syncStatus -> detailsNode.put("sync_status", syncStatus));
            parseStringField(after, FIELD_RUN_STATUS)
                    .ifPresent(runStatus -> detailsNode.put("run_status", runStatus));
            parseStringField(after, FIELD_TASK_ID)
                    .ifPresent(taskId -> detailsNode.put("task_id", taskId));

            if (detailsNode.isEmpty()) {
                return null;
            }
            return mapper.writeValueAsString(detailsNode);
        } catch (Exception e) {
            log.error("Failed to build details JSON for task result", e);
            return null;
        }
    }
}
