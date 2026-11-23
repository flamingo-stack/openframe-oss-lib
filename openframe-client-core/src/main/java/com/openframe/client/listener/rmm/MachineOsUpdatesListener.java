package com.openframe.client.listener.rmm;

import com.openframe.client.exception.MalformedDeviceOsReportException;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportFacade;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@Slf4j
public class MachineOsUpdatesListener extends AbstractJetStreamPushListener {

    private final DeviceOsReportFacade deviceOsReportFacade;
    private final NatsTopicMachineIdExtractor natsTopicMachineIdExtractor;

    public MachineOsUpdatesListener(
            Connection natsConnection,
            DeviceOsReportFacade deviceOsReportFacade,
            NatsTopicMachineIdExtractor natsTopicMachineIdExtractor
    ) {
        super(natsConnection);
        this.deviceOsReportFacade = deviceOsReportFacade;
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
        String subject = message.getSubject();
        try {
            applyReport(message);
            message.ack();
        } catch (MalformedDeviceOsReportException | IllegalArgumentException permanentlyBad) {
            dropMalformed(message, permanentlyBad);
        } catch (Exception e) {
            log.error("Unexpected error processing OS report subject={}", subject, e);
        }
    }

    private void applyReport(Message message) {
        String machineId = natsTopicMachineIdExtractor.extract(message.getSubject());
        Instant receivedAt = message.metaData().timestamp().toInstant();
        log.debug("Processing OS report: machineId={} receivedAt={}", machineId, receivedAt);
        deviceOsReportFacade.applyReport(machineId, message.getData(), receivedAt);
    }

    private static void dropMalformed(Message message, Exception permanentlyBad) {
        log.warn("Dropping malformed OS report subject={} payloadBytes={}",
                message.getSubject(), message.getData().length, permanentlyBad);
        message.ack();
    }
}
