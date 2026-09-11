package com.openframe.client.service.rmm.watchdog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SoftwareDeliveryRepublisher implements DeliveryRepublisher {

    private final ObjectMapper objectMapper;
    private final SoftwareNatsPublisher softwareNatsPublisher;

    @Override
    public DeliveryChannel channel() {
        return DeliveryChannel.SOFTWARE;
    }

    @Override
    public void republish(String machineId, String messageJson) {
        try {
            ScriptMessage message = objectMapper.readValue(messageJson, ScriptMessage.class);
            softwareNatsPublisher.publishSoftware(machineId, message);
        } catch (Exception e) {
            log.warn("Failed to re-publish software delivery machineId={}: {}", machineId, e.getMessage());
        }
    }
}
