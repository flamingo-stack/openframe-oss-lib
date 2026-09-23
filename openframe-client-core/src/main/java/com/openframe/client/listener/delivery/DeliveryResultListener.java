package com.openframe.client.listener.delivery;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.DeliveryResultMessage;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.delivery.track.DeliveryTracker;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
public class DeliveryResultListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final NatsTopicMachineIdExtractor machineIdExtractor;
    private final DeliveryTracker deliveryTracker;

    public DeliveryResultListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            NatsTopicMachineIdExtractor machineIdExtractor,
            DeliveryTracker deliveryTracker
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.machineIdExtractor = machineIdExtractor;
        this.deliveryTracker = deliveryTracker;
    }

    @Override
    protected String getStreamName() {
        return DeliveryResultMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return DeliveryResultMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "delivery-result-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "delivery-result";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.delivery.result.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            String machineId = machineIdExtractor.extract(subject);
            DeliveryResultMessage report = objectMapper.readValue(payload, DeliveryResultMessage.class);
            if (!isComplete(report)) {
                log.warn("Delivery result without type, targetId, dispatchId or result dropped: machineId={} payload={}", machineId, payload);
                message.ack();
                return;
            }
            apply(machineId, report);
            message.ack();
        } catch (JsonProcessingException | IllegalArgumentException permanentlyBad) {
            log.warn("Dropping malformed delivery result subject={} payload={}", subject, payload, permanentlyBad);
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing delivery result: {}", payload, e);
        }
    }

    private void apply(String machineId, DeliveryResultMessage report) {
        DeliveryType type = report.getType();
        String targetId = report.getTargetId();
        String dispatchId = report.getDispatchId();
        switch (report.getResult()) {
            case ACKED -> deliveryTracker.acknowledge(type, targetId, machineId, dispatchId);
            case DONE -> deliveryTracker.complete(type, targetId, machineId, dispatchId);
            case FAILED -> deliveryTracker.fail(type, targetId, machineId, dispatchId, report.getError());
        }
    }

    private static boolean isComplete(DeliveryResultMessage report) {
        return report.getType() != null
                && hasText(report.getTargetId())
                && hasText(report.getDispatchId())
                && report.getResult() != null;
    }
}
