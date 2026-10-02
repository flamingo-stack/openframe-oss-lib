package com.openframe.delivery.event;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

// the row closed as FAILED: retries exhausted, machine never came back, no result after the ACK, or the agent reported an error
@Getter
public class DeliveryFailedEvent extends ApplicationEvent {

    private final DeliveryType type;
    private final String targetId;
    private final String machineId;
    private final String dispatchId;
    private final DeliveryFailure failure;
    private final String error;

    public DeliveryFailedEvent(Object source, DeliveryType type, String targetId, String machineId, String dispatchId,
                               DeliveryFailure failure, String error) {
        super(source);
        this.type = type;
        this.targetId = targetId;
        this.machineId = machineId;
        this.dispatchId = dispatchId;
        this.failure = failure;
        this.error = error;
    }
}
