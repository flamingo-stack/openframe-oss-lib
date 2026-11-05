package com.openframe.delivery.dispatch;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.core.util.Sha256;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DeliveryPayloadJson {

    private static final String DELIVERY_FIELD = "delivery";

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
        return new DeliveryPayloadBody(json, Sha256.hex(json));
    }

    private String write(ObjectNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JacksonException e) {
            throw new IllegalArgumentException("Delivery payload body is not serializable", e);
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
