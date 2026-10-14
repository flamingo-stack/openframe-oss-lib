package com.openframe.delivery.dispatch;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.openframe.delivery.spec.DeliveryPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DeliveryPayloadJson {

    private final ObjectMapper objectMapper;

    public String write(DeliveryPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException e) {
            String payloadType = payload.getClass().getSimpleName();
            throw new IllegalArgumentException("Delivery payload is not serializable: " + payloadType, e);
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
