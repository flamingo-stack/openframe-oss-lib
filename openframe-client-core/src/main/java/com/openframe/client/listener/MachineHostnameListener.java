package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.MachineHostnameService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.model.MachineHostnameMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@Slf4j
public class MachineHostnameListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final MachineHostnameService machineHostnameService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    public MachineHostnameListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            MachineHostnameService machineHostnameService,
            NatsTopicMachineIdExtractor machineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.machineHostnameService = machineHostnameService;
        this.machineIdExtractor = machineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return "MACHINE_HOSTNAME";
    }

    @Override
    protected String getSubject() {
        return "machine.*.hostname";
    }

    @Override
    protected String getConsumerName() {
        return "machine-hostname-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "machine-hostname";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.hostname.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String messagePayload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();

        try {
            String machineId = machineIdExtractor.extract(subject);
            MachineHostnameMessage hostnameMessage = objectMapper.readValue(messagePayload, MachineHostnameMessage.class);

            String hostname = hostnameMessage.getHostname();
            if (isBlank(hostname)) {
                log.warn("Hostname message without hostname for machineId={}, acking without update", machineId);
                message.ack();
                return;
            }

            log.info("Processing hostname update: machineId={} hostname={}", machineId, hostname);

            machineHostnameService.updateHostname(machineId, hostname);

            message.ack();
            log.debug("Hostname update processed successfully and acked");
        } catch (Exception e) {
            log.error("Unexpected error processing hostname update: {}", messagePayload, e);
            // Don't ack the message and let it be redelivered
            log.info("Leaving message unacked for potential redelivery: hostname update");
        }
    }
}
