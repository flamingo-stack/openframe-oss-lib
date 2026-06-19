package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.MessageType;
import org.springframework.stereotype.Component;

/**
 * Binds the shared {@link RmmResultDeserializer} logic to
 * {@link MessageType#SCRIPT_EXECUTED} — results of saved-script executions.
 */
@Component
public final class ScriptResultDeserializer extends RmmResultDeserializer {

    ScriptResultDeserializer(ObjectMapper mapper) {
        super(mapper);
    }

    @Override
    public MessageType getType() {
        return MessageType.SCRIPT_EXECUTED;
    }
}
