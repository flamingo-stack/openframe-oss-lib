package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.PackageManagerBootstrapService;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.rmm.model.PackageManagerMissingMessage;
import com.openframe.data.document.packagesearch.PackageManagerType;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class PackageManagerMissingListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final PackageManagerBootstrapService bootstrapService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    public PackageManagerMissingListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            PackageManagerBootstrapService bootstrapService,
            NatsTopicMachineIdExtractor machineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.bootstrapService = bootstrapService;
        this.machineIdExtractor = machineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return PackageManagerMissingMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return PackageManagerMissingMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "package-manager-missing-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "package-manager-missing";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.package-manager-missing.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            String machineId = machineIdExtractor.extract(subject);
            PackageManagerMissingMessage report = objectMapper.readValue(payload, PackageManagerMissingMessage.class);

            PackageManagerType packageManager = report.getPackageManager();
            if (packageManager == null) {
                log.warn("Package-manager report without a manager for machineId={}, acking without dispatch", machineId);
                message.ack();
                return;
            }

            log.info("Processing package-manager report: machineId={} packageManager={}", machineId, packageManager);
            bootstrapService.dispatchInstall(machineId, packageManager);

            message.ack();
        } catch (JsonProcessingException | IllegalArgumentException permanentlyBad) {
            // A malformed subject/payload never gets better — redelivering it 50 times only spams the log.
            log.warn("Dropping malformed package-manager report subject={} payload={}", subject, payload, permanentlyBad);
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing package-manager report: {}", payload, e);
            // Leave unacked so JetStream redelivers.
        }
    }
}
