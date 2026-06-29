package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.stream.mapping.SourceEventTypes;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;

/**
 * Binds the shared {@link RmmResultDeserializer} logic to
 * {@link MessageType#COMMAND_EXECUTED} — results of ad-hoc commands.
 */
@Component
public final class CommandResultDeserializer extends RmmResultDeserializer {

    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";

    private final CommandExecutionRepository commandExecutionRequestRepository;

    CommandResultDeserializer(ObjectMapper mapper,
                              CommandExecutionRepository commandExecutionRequestRepository) {
        super(mapper);
        this.commandExecutionRequestRepository = commandExecutionRequestRepository;
    }

    @Override
    public MessageType getType() {
        return MessageType.COMMAND_EXECUTED;
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode after) {
        return Optional.of(SourceEventTypes.Rmm.CMD_RUN_FINISHED);
    }

    @Override
    public DeserializedDebeziumMessage deserialize(CommonDebeziumMessage message, MessageType messageType) {
        DeserializedDebeziumMessage result = super.deserialize(message, messageType);
        if (result == null) {
            return null;
        }
        result.setExcludedDestinations(excludedDestinationsFor(message.getPayload().getAfter()));
        return result;
    }

    public Set<Destination> excludedDestinationsFor(JsonNode after) {
        String executionId = text(after, FIELD_EXECUTION_ID);
        String machineId = text(after, FIELD_MACHINE_ID);

        boolean pending = executionId != null && machineId != null
                && commandExecutionRequestRepository.findByMachineIdAndExecutionId(machineId, executionId)
                .map(request -> request.getStatus() == ExecutionStatus.RUNNING)
                .orElse(false);

        // A tracked batch command (RUNNING row exists) → results go to the command-specific
        // sinks (Cassandra command_results + the Mongo CommandExecution write-back), so the
        // generic event-log + Pinot analytics are excluded. Otherwise (ad-hoc / legacy command)
        // keep the old behaviour and exclude the command-specific sinks.
        return pending
                ? Set.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT)
                : Set.of(Destination.CASSANDRA_COMMAND_RESULT, Destination.MONGO_COMMAND_HISTORY);
    }

    private static String text(JsonNode after, String field) {
        JsonNode node = after.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }
}
