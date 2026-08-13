package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.ToolConnectionService;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.model.ToolConnectionMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Slf4j
// TODO: remove spring cloud stream configs as deprecated
public class ToolConnectionListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final ToolConnectionService toolConnectionService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    public ToolConnectionListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            ToolConnectionService toolConnectionService,
            NatsTopicMachineIdExtractor machineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.toolConnectionService = toolConnectionService;
        this.machineIdExtractor = machineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return "TOOL_CONNECTIONS";
    }

    @Override
    protected String getSubject() {
        return "machine.*.tool-connection";
    }

    /* During hotfix updated consumer name with v2 suffix.
        Motivation of this change that it was consumer without delivery group before
        and it's impossible to apply new delivery group to old environments.
        Finally it will be new consumer with delivery group.
        Previous consumer is deprecated.
     */
    @Override
    protected String getConsumerName() {
        return "tool-connection-processor-v2";
    }

    @Override
    protected String getDeliveryGroup() {
        return "tool-connection";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.tool-connection.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String messagePayload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();

        try {
            String machineId = machineIdExtractor.extract(subject);
            ToolConnectionMessage toolConnectionMessage = objectMapper.readValue(messagePayload, ToolConnectionMessage.class);

            String toolType = toolConnectionMessage.getToolType();
            String agentToolId = toolConnectionMessage.getAgentToolId();
            long deliveredCount = message.metaData().deliveredCount();
            boolean lastAttempt = isLastAttempt(deliveredCount);

            log.debug("Processing tool connection: machineId={} toolType={} agentToolId={} (delivery={})", machineId, toolType, agentToolId, deliveredCount);

            // Process the tool connection
            toolConnectionService.addToolConnection(machineId, toolType, agentToolId, lastAttempt);

            // Acknowledge successful processing
            message.ack();
            log.debug("Tool connection processed successfully and acked");
        } catch (Exception e) {
            log.error("Unexpected error processing tool connection: {}", messagePayload, e);
            // Don't ack the message and let it be redelivered
            log.debug("Leaving message unacked for potential redelivery: tool connection");
        }
    }
}
