package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.CommandExecutionStatus;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.CommandExecutionRequestRepository;
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

    private final CommandExecutionRequestRepository commandExecutionRequestRepository;

    CommandResultDeserializer(ObjectMapper mapper,
                              CommandExecutionRequestRepository commandExecutionRequestRepository) {
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
                .map(request -> request.getStatus() == CommandExecutionStatus.PENDING)
                .orElse(false);

        return pending
                ? Set.of(Destination.CASSANDRA, Destination.KAFKA)
                : Set.of(Destination.CASSANDRA_COMMAND_RESULT);
    }

    private static String text(JsonNode after, String field) {
        JsonNode node = after.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }
}
