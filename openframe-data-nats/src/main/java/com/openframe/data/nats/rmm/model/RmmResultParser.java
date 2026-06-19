package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Single deserialization seam for any {@link RmmResultMessage} subtype. Each
 * listener picks the concrete subtype it expects (via the NATS subject it
 * subscribed to) and hands the raw payload here; the underlying JSON parsing
 * (snake_case mapping, unknown-property tolerance, etc.) lives in one place so
 * it can't drift between {@code CommandResultListener} and
 * {@code ScriptResultListener}.
 */
@Component
@RequiredArgsConstructor
public class RmmResultParser {

    private final ObjectMapper objectMapper;

    public <T extends RmmResultMessage> T parse(byte[] payload, Class<T> targetType) throws IOException {
        return objectMapper.readValue(payload, targetType);
    }
}
