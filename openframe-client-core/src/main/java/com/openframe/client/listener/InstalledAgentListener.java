package com.openframe.client.listener;

import java.util.List;
import tools.jackson.databind.ObjectMapper;
import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.client.service.InstalledAgentService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.model.InstalledAgentMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class InstalledAgentListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final InstalledAgentService installedAgentService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;
    private final AuditRecorder auditRecorder;

    public InstalledAgentListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            InstalledAgentService installedAgentService,
            NatsTopicMachineIdExtractor machineIdExtractor,
            AuditRecorder auditRecorder
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.installedAgentService = installedAgentService;
        this.machineIdExtractor = machineIdExtractor;
        this.auditRecorder = auditRecorder;
    }

    @Override
    protected String getStreamName() {
        return "INSTALLED_AGENTS";
    }

    @Override
    protected String getSubject() {
        return "machine.*.installed-agent";
    }

    @Override
    protected String getConsumerName() {
        return "installed-agent-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "installed-agent";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.installed-agent.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String messagePayload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();

        try {
            String machineId = machineIdExtractor.extract(subject);
            InstalledAgentMessage installedAgentMessage = objectMapper.readValue(messagePayload, InstalledAgentMessage.class);

            String agentType = installedAgentMessage.getAgentType();
            String version = installedAgentMessage.getVersion();
            long deliveredCount = message.metaData().deliveredCount();
            boolean lastAttempt = isLastAttempt(deliveredCount);

            log.info("Processing installed agent: machineId={} agentType={} version={} (delivery={})",
                    machineId, agentType, version, deliveredCount);

            // Process the installed agent
            AuditContext device = auditRecorder.context(AuditActor.fromAgent(machineId, List.of(), null));
            auditRecorder.within(device,
                    () -> installedAgentService.addInstalledAgent(machineId, agentType, version, lastAttempt));

            // Acknowledge successful processing
            message.ack();
            log.info("Installed agent processed successfully and acked");
        } catch (Exception e) {
            log.error("Unexpected error processing installed agent: {}", messagePayload, e);
            // Don't ack the message and let it be redelivered
            log.info("Leaving message unacked for potential redelivery: installed agent");
        }
    }
}
