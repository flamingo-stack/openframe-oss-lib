package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

// one fire of a schedule on one machine: the batch the schedule's dispatcher built, under the fire's executionId, and
// the schedule's own rule for a machine that is not online at that moment
@Getter
@RequiredArgsConstructor
public class ScriptScheduleDeliverySeed implements DeliverySeed {

    private final String machineId;
    private final ScriptScheduleExecutionMessage message;
    private final DeliveryOfflineBehavior offlineBehavior;
    private final Long reconnectWindowSeconds;

    public static ScriptScheduleDeliverySeed skippingOffline(String machineId, ScriptScheduleExecutionMessage message) {
        return new ScriptScheduleDeliverySeed(machineId, message, DeliveryOfflineBehavior.SKIP, null);
    }

    public static ScriptScheduleDeliverySeed waitingForReconnect(String machineId, ScriptScheduleExecutionMessage message,
                                                                 long reconnectWindowSeconds) {
        return new ScriptScheduleDeliverySeed(machineId, message, DeliveryOfflineBehavior.RETRY_ON_RECONNECT,
                reconnectWindowSeconds);
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.SCRIPT_SCHEDULE;
    }

    @Override
    public String getTargetId() {
        return message.getExecutionId();
    }
}
