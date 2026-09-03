package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.MachineTimezoneService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.model.MachineTimezoneMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@Slf4j
public class MachineTimezoneListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final MachineTimezoneService machineTimezoneService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    public MachineTimezoneListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            MachineTimezoneService machineTimezoneService,
            NatsTopicMachineIdExtractor machineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.machineTimezoneService = machineTimezoneService;
        this.machineIdExtractor = machineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return "MACHINE_TIMEZONE";
    }

    @Override
    protected String getSubject() {
        return "machine.*.timezone";
    }

    @Override
    protected String getConsumerName() {
        return "machine-timezone-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "machine-timezone";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.timezone.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            String machineId = machineIdExtractor.extract(subject);
            MachineTimezoneMessage timezoneMessage = objectMapper.readValue(payload, MachineTimezoneMessage.class);

            String timezone = timezoneMessage.getTimezone();
            if (isBlank(timezone)) {
                log.warn("Timezone message without timezone for machineId={}, acking without update", machineId);
                message.ack();
                return;
            }

            log.info("Processing timezone update: machineId={} timezone={}", machineId, timezone);
            machineTimezoneService.updateTimezone(machineId, timezone);

            message.ack();
            log.debug("Timezone update processed successfully and acked");
        } catch (Exception e) {
            log.error("Unexpected error processing timezone update: {}", payload, e);
            // Leave unacked so JetStream redelivers.
        }
    }
}
