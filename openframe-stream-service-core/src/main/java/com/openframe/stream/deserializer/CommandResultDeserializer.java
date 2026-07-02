package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.MessageType;
import com.openframe.stream.mapping.SourceEventTypes;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Binds the shared {@link RmmResultDeserializer} logic to
 * {@link MessageType#COMMAND_EXECUTED} — results of native OpenFrame commands.
 *
 * <p>Routing is static (see {@code MessageType.COMMAND_EXECUTED}): every command
 * result feeds ALL of its destinations — the generic event-log + Pinot (so it shows
 * up in the Logs UI exactly like a script) AND the command-specific sinks
 * (Cassandra {@code command_results} + the Mongo {@code CommandExecution} write-back).
 * The command-specific handlers correlate on {@code (machineId, executionId)}
 * themselves, so no per-message routing decision is made here.
 */
@Component
public final class CommandResultDeserializer extends RmmResultDeserializer {

    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_TIMED_OUT = "timedOut";

    public CommandResultDeserializer(ObjectMapper mapper) {
        super(mapper);
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
    protected Optional<String> getMessage(JsonNode after) {
        boolean timedOut = parseStringField(after, FIELD_TIMED_OUT).map(Boolean::parseBoolean).orElse(false);
        if (timedOut) {
            return Optional.of("Command timed out");
        }
        return parseStringField(after, FIELD_EXIT_CODE)
                .map(code -> "Command finished (exit code %s)".formatted(code))
                .or(() -> Optional.of("Command finished"));
    }
}
