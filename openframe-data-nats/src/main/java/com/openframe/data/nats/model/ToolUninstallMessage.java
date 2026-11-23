package com.openframe.data.nats.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Data;

@Data
public class ToolUninstallMessage implements DeliveryPayload {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private DeliveryRef delivery;
    private String toolAgentId;
    private String toolType;
}
