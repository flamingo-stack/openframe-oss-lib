package com.openframe.data.nats.rmm.model;

import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RmmResultParser {

    private final ObjectMapper objectMapper;

    public <T extends RmmResultMessage> T parse(byte[] payload, Class<T> targetType) {
        return objectMapper.readValue(payload, targetType);
    }
}
