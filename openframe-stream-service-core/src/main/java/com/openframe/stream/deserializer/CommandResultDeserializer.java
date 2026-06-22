package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.MessageType;
import com.openframe.stream.mapping.SourceEventTypes;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Binds the shared {@link RmmResultDeserializer} logic to
 * {@link MessageType#COMMAND_EXECUTED} — results of ad-hoc commands.
 */
@Component
public final class CommandResultDeserializer extends RmmResultDeserializer {

    CommandResultDeserializer(ObjectMapper mapper) {
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
}
