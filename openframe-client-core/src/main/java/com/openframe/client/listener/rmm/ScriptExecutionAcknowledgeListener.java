package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.ScriptExecutionAcknowledgeService;
import com.openframe.client.service.rmm.delivery.DeliveryTracker;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.rmm.model.ScriptExecutionAcknowledgeMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class ScriptExecutionAcknowledgeListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final ScriptExecutionAcknowledgeService acknowledgeService;
    private final DeliveryTracker deliveryTracker;

    public ScriptExecutionAcknowledgeListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            ScriptExecutionAcknowledgeService acknowledgeService,
            DeliveryTracker deliveryTracker
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.acknowledgeService = acknowledgeService;
        this.deliveryTracker = deliveryTracker;
    }

    @Override
    protected String getStreamName() {
        return "EXECUTION_ACKNOWLEDGE";
    }

    @Override
    protected String getSubject() {
        return "machine.*.execution.acknowledge";
    }

    @Override
    protected String getConsumerName() {
        return "execution-acknowledge-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "execution-acknowledge";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.execution.acknowledge.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        try {
            ScriptExecutionAcknowledgeMessage ack = objectMapper.readValue(payload, ScriptExecutionAcknowledgeMessage.class);
            if (isDeliveryAck(ack)) {
                deliveryTracker.acknowledge(ack.getKind(), ack.getTargetId(), ack.getMachineId());
            }
            if (isScriptAck(ack)) {
                acknowledgeService.acknowledge(ack);
            }
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing execution ack: {}", payload, e);
        }
    }

    private static boolean isDeliveryAck(ScriptExecutionAcknowledgeMessage ack) {
        return ack.getKind() != null && ack.getTargetId() != null;
    }

    private static boolean isScriptAck(ScriptExecutionAcknowledgeMessage ack) {
        return ack.getKind() == null || ack.getKind() == DeliveryKind.SCRIPT_SCHEDULE;
    }
}
