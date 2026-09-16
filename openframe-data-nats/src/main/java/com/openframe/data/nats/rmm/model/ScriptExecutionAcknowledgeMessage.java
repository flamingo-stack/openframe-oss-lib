package com.openframe.data.nats.rmm.model;

import com.openframe.data.document.delivery.DeliveryType;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptExecutionAcknowledgeMessage {

    private String executionId;
    private String machineId;
    private String scheduleId;
    private List<String> scriptIds;

    // null from agents that predate the delivery engine: treat as a script ack
    private DeliveryType type;
    private String targetId;
}
