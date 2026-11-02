package com.openframe.client.listener.packageupdate;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
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
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
public class PackageUpdateStatusListener extends AbstractJetStreamPushListener {

    private static final String REJECTED_INCOMPLETE = "incomplete";
    private static final String REJECTED_MALFORMED = "malformed";

    private final ObjectMapper objectMapper;
    private final NatsTopicMachineIdExtractor machineIdExtractor;
    private final PackageUpdateStatusProcessor processor;

    public PackageUpdateStatusListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            NatsTopicMachineIdExtractor machineIdExtractor,
            PackageUpdateStatusProcessor processor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.machineIdExtractor = machineIdExtractor;
        this.processor = processor;
    }

    @Override
    protected String getStreamName() {
        return PackageUpdateStatusMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return PackageUpdateStatusMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "package-update-status-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "package-update-status";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.package-update.status.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            String machineId = machineIdExtractor.extract(subject);
            PackageUpdateStatusMessage event = objectMapper.readValue(payload, PackageUpdateStatusMessage.class);
            if (!isComplete(event)) {
                log.error("Package-update status rejected, agent violates the contract (ids or state missing/unknown): machineId={} payload={}",
                        machineId, payload);
                message.ack();
                return;
            }
            processor.process(machineId, event);
            message.ack();
        } catch (JacksonException | IllegalArgumentException permanentlyBad) {
            log.error("Package-update status rejected, malformed: subject={} payload={}", subject, payload, permanentlyBad);
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing package-update status: {}", payload, e);
        }
    }

    private static boolean isComplete(PackageUpdateStatusMessage event) {
        return event != null
                && hasText(event.getEventId())
                && hasText(event.getRequestId())
                && hasText(event.getMachineId())
                && event.getState() != null;
    }
}
