package com.openframe.data.nats.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Data;

@Data
public class ClientUninstallMessage implements DeliveryPayload {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private DeliveryRef delivery;

    /**
     * When the command was issued (ISO-8601 instant). Lets the agent ignore
     * stale commands replayed from the stream, e.g. after a reinstall.
     */
    private String issuedAt;

}
