package com.openframe.client.service.rmm.watchdog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleDeliveryRepublisher implements DeliveryRepublisher {

    private final ObjectMapper objectMapper;
    private final ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;

    @Override
    public DeliveryChannel channel() {
        return DeliveryChannel.SCHEDULE;
    }

    @Override
    public void republish(String machineId, String messageJson) {
        try {
            ScriptScheduleExecutionMessage message =
                    objectMapper.readValue(messageJson, ScriptScheduleExecutionMessage.class);
            scriptScheduleNatsPublisher.publish(machineId, message);
        } catch (Exception e) {
            log.warn("Failed to re-publish schedule delivery machineId={}: {}", machineId, e.getMessage());
        }
    }
}
