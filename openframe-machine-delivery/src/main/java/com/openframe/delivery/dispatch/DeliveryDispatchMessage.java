package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.openframe.delivery.spec.DeliveryAudience;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryDispatchMessage {

    private DeliveryAudience audience;
    // the one machine; absent when the audience is every machine
    private String machineId;
    // the command as the agent will receive it; its delivery block carries type, targetId and dispatchId
    private JsonNode payload;
}
