package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AllArgsConstructor;
import lombok.Getter;

// one fire of a schedule on one machine: the batch the schedule's dispatcher built, under the fire's executionId
@Getter
@AllArgsConstructor
public class ScriptScheduleDeliverySeed implements DeliverySeed {

    private final String machineId;
    private final ScriptScheduleExecutionMessage message;

    @Override
    public DeliveryType getType() {
        return DeliveryType.SCRIPT_SCHEDULE;
    }

    @Override
    public String getTargetId() {
        return message.getExecutionId();
    }
}
