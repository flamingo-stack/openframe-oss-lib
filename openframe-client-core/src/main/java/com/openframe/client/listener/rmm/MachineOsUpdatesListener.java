package com.openframe.client.listener.rmm;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.MachineOsUpdatesService;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@Slf4j
public class MachineOsUpdatesListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final MachineOsUpdatesService machineOsUpdatesService;
    private final NatsTopicMachineIdExtractor natsTopicMachineIdExtractor;

    public MachineOsUpdatesListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            MachineOsUpdatesService machineOsUpdatesService,
            NatsTopicMachineIdExtractor natsTopicMachineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.machineOsUpdatesService = machineOsUpdatesService;
        this.natsTopicMachineIdExtractor = natsTopicMachineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return MachineOsUpdatesMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return MachineOsUpdatesMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "machine-os-updates-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "machine-os-updates";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.os-updates.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            applyReport(message, subject, payload);
            message.ack();
        } catch (JacksonException | IllegalArgumentException permanentlyBad) {
            dropMalformed(message, permanentlyBad);
        } catch (Exception e) {
            log.error("Unexpected error processing OS-updates report subject={}", subject, e);
        }
    }

    private void applyReport(Message message, String subject, String payload) {
        String machineId = natsTopicMachineIdExtractor.extract(subject);
        MachineOsUpdatesMessage report = objectMapper.readValue(payload, MachineOsUpdatesMessage.class);
        if (lacksOsState(report)) {
            log.warn("OS-updates report without osState for machineId={}, acking without update", machineId);
            return;
        }
        Instant receivedAt = message.metaData().timestamp().toInstant();
        log.debug("Processing OS-updates report: machineId={} receivedAt={}", machineId, receivedAt);
        machineOsUpdatesService.apply(machineId, report, receivedAt);
    }

    private static boolean lacksOsState(MachineOsUpdatesMessage report) {
        return report == null || report.getOsState() == null;
    }

    private static void dropMalformed(Message message, Exception permanentlyBad) {
        log.warn("Dropping malformed OS-updates report subject={} payloadBytes={}",
                message.getSubject(), message.getData().length, permanentlyBad);
        message.ack();
    }
}
