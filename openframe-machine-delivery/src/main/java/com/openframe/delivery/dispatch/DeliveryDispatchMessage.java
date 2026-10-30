package com.openframe.delivery.dispatch;

import tools.jackson.databind.JsonNode;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.kafka.model.KafkaMessage;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryDispatchMessage implements KafkaMessage {

    private DeliveryAudience audience;
    // the one machine; absent when the audience is every machine
    private String machineId;
    // the command as the agent will receive it; its delivery block carries type, targetId and dispatchId
    private JsonNode payload;
    // when the command is due to reach the machine; absent = at once. A client-service older than this field ignores
    // it and publishes at once, so it is deployed before any service schedules over Kafka
    private Instant dueAt;

    public DeliveryDispatchMessage(DeliveryAudience audience, String machineId, JsonNode payload) {
        this(audience, machineId, payload, null);
    }
}
