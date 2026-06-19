package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.MessageType;
import org.springframework.stereotype.Component;

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
}
