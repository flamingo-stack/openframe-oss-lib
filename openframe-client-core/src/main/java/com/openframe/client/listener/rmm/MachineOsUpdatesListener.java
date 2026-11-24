package com.openframe.client.listener.rmm;

import com.openframe.client.exception.MalformedDeviceOsReportException;
import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportFacade;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportOutcome;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import io.nats.client.Connection;
import io.micrometer.core.instrument.Timer;
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
    private final DeviceOsReportMetrics deviceOsReportMetrics;

    public MachineOsUpdatesListener(
            Connection natsConnection,
            DeviceOsReportFacade deviceOsReportFacade,
            NatsTopicMachineIdExtractor natsTopicMachineIdExtractor,
            DeviceOsReportMetrics deviceOsReportMetrics
    ) {
        super(natsConnection);
        this.deviceOsReportFacade = deviceOsReportFacade;
        this.natsTopicMachineIdExtractor = natsTopicMachineIdExtractor;
        this.deviceOsReportMetrics = deviceOsReportMetrics;
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
        Timer.Sample reportStarted = deviceOsReportMetrics.startReport();
        DeviceOsReportOutcome deviceOsReportOutcome = handleReport(message);
        deviceOsReportMetrics.recordHandled(reportStarted, deviceOsReportOutcome);
    }

    private DeviceOsReportOutcome handleReport(Message message) {
        try {
            DeviceOsReportOutcome deviceOsReportOutcome = applyReport(message);
            message.ack();
            return deviceOsReportOutcome;
        } catch (MalformedDeviceOsReportException permanentlyBad) {
            dropMalformed(message, permanentlyBad);
            return DeviceOsReportOutcome.MALFORMED;
        } catch (Exception e) {
            log.error("Unexpected error processing OS report subject={}", message.getSubject(), e);
            deviceOsReportMetrics.recordFailed(e);
            return DeviceOsReportOutcome.FAILED;
        }
    }

    private DeviceOsReportOutcome applyReport(Message message) {
        Instant receivedAt = message.metaData().timestamp().toInstant();
        deviceOsReportMetrics.recordReceived(message.getData().length, receivedAt);
        String machineId = extractMachineId(message);
        log.debug("Processing OS report: machineId={} receivedAt={}", machineId, receivedAt);
        return deviceOsReportFacade.applyReport(machineId, message.getData(), receivedAt);
    }

    private String extractMachineId(Message message) {
        try {
            return natsTopicMachineIdExtractor.extract(message.getSubject());
        } catch (IllegalArgumentException invalidSubject) {
            throw new MalformedDeviceOsReportException("OS report on an invalid subject", invalidSubject);
        }
    }

    private static void dropMalformed(Message message, Exception permanentlyBad) {
        log.warn("Dropping malformed OS report subject={} payloadBytes={}",
                message.getSubject(), message.getData().length, permanentlyBad);
        message.ack();
    }
}
