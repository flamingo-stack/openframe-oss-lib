package com.openframe.delivery.event;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

// the agent confirmed it holds the command; published once, on the real PENDING -> ACKED transition
@Getter
public class DeliveryAckedEvent extends ApplicationEvent {

    private final DeliveryType type;
    private final String targetId;
    private final String machineId;
    private final String dispatchId;

    public DeliveryAckedEvent(Object source, DeliveryType type, String targetId, String machineId, String dispatchId) {
        super(source);
        this.type = type;
        this.targetId = targetId;
        this.machineId = machineId;
        this.dispatchId = dispatchId;
    }
}
