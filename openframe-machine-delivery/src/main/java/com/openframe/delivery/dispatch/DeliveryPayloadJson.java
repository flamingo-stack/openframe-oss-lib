package com.openframe.delivery.dispatch;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.openframe.delivery.spec.DeliveryPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Component
@RequiredArgsConstructor
public class DeliveryPayloadJson {

    private static final String DELIVERY_FIELD = "delivery";
    private static final String HASH_ALGORITHM = "SHA-256";

    private final ObjectMapper objectMapper;

    public String write(DeliveryPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException e) {
            String payloadType = payload.getClass().getSimpleName();
            throw new IllegalArgumentException("Delivery payload is not serializable: " + payloadType, e);
        }
    }

    // the body is the payload without the row's delivery block, so every row of one content shares one body
    public DeliveryPayloadBody body(DeliveryPayload payload) {
        ObjectNode node = objectMapper.valueToTree(payload);
        node.remove(DELIVERY_FIELD);
        String json = write(node);
        return new DeliveryPayloadBody(json, hash(json));
    }

    private String write(ObjectNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JacksonException e) {
            throw new IllegalArgumentException("Delivery payload body is not serializable", e);
        }
    }

    private static String hash(String json) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            byte[] hashed = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(HASH_ALGORITHM + " is not available", e);
        }
    }

    public <P extends DeliveryPayload> P read(String payloadJson, Class<P> payloadClass) {
        try {
            return objectMapper.readValue(payloadJson, payloadClass);
        } catch (JacksonException e) {
            String payloadType = payloadClass.getSimpleName();
            throw new IllegalStateException("Corrupt delivery payload: " + payloadType, e);
        }
    }
}
