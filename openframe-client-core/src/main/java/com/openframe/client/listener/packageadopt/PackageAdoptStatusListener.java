package com.openframe.client.listener.packageadopt;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
public class PackageAdoptStatusListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final NatsTopicMachineIdExtractor natsTopicMachineIdExtractor;
    private final PackageAdoptStatusProcessor packageAdoptStatusProcessor;

    public PackageAdoptStatusListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            NatsTopicMachineIdExtractor natsTopicMachineIdExtractor,
            PackageAdoptStatusProcessor packageAdoptStatusProcessor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.natsTopicMachineIdExtractor = natsTopicMachineIdExtractor;
        this.packageAdoptStatusProcessor = packageAdoptStatusProcessor;
    }

    @Override
    protected String getStreamName() {
        return PackageAdoptStatusMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return PackageAdoptStatusMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "package-adopt-status-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "package-adopt-status";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.package-adopt.status.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            String machineId = natsTopicMachineIdExtractor.extract(subject);
            PackageAdoptStatusMessage event = objectMapper.readValue(payload, PackageAdoptStatusMessage.class);
            if (!isComplete(event)) {
                log.error("Package-adopt status rejected, agent violates the contract (ids or state missing/unknown): machineId={} payload={}",
                        machineId, payload);
                message.ack();
                return;
            }
            packageAdoptStatusProcessor.process(machineId, event);
            message.ack();
        } catch (JacksonException | IllegalArgumentException permanentlyBad) {
            log.error("Package-adopt status rejected, malformed: subject={} payload={}", subject, payload, permanentlyBad);
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing package-adopt status: {}", payload, e);
        }
    }

    private static boolean isComplete(PackageAdoptStatusMessage event) {
        return event != null
                && hasText(event.getEventId())
                && hasText(event.getRequestId())
                && hasText(event.getMachineId())
                && event.getState() != null;
    }
}
