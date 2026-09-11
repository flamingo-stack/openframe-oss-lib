package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class RmmResultParser {

    private final ObjectMapper objectMapper;

    public <T extends RmmResultMessage> T parse(byte[] payload, Class<T> targetType) throws IOException {
        return objectMapper.readValue(payload, targetType);
    }
}
