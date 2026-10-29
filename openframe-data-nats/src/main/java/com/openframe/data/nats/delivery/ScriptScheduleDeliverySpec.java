package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ScriptScheduleDeliverySpec implements DeliverySpec<ScriptScheduleDeliverySeed, ScriptScheduleExecutionMessage> {

    // the subject every agent since the schedule listener subscribes to over core NATS, no stream behind it: the
    // engine and the path without it send the same message there, the agent answers both on execution.acknowledge
    private static final String SUBJECT_TEMPLATE = "machine.%s.script-schedule-execution";

    @Override
    public DeliveryType getType() {
        return DeliveryType.SCRIPT_SCHEDULE;
    }

    @Override
    public Class<ScriptScheduleExecutionMessage> getPayloadClass() {
        return ScriptScheduleExecutionMessage.class;
    }

    @Override
    public DeliveryRequest<ScriptScheduleExecutionMessage> request(ScriptScheduleDeliverySeed seed) {
        return DeliveryRequest.<ScriptScheduleExecutionMessage>builder()
                .type(DeliveryType.SCRIPT_SCHEDULE)
                .targetId(seed.getTargetId())
                .machineId(seed.getMachineId())
                .payload(seed.getMessage())
                .build();
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }
}
