package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.MachinePackageManagersService;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.rmm.model.MachinePackageManagersMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@Slf4j
public class MachinePackageManagersListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final MachinePackageManagersService packageManagersService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    public MachinePackageManagersListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            MachinePackageManagersService packageManagersService,
            NatsTopicMachineIdExtractor machineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.packageManagersService = packageManagersService;
        this.machineIdExtractor = machineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return MachinePackageManagersMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return MachinePackageManagersMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "machine-package-managers-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "machine-package-managers";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.package-managers.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        try {
            String machineId = machineIdExtractor.extract(subject);
            MachinePackageManagersMessage report = objectMapper.readValue(payload, MachinePackageManagersMessage.class);

            Map<String, PackageManagerState> packageManagers = report.getPackageManagers();
            if (isEmpty(packageManagers)) {
                log.warn("Package-managers report without entries for machineId={}, acking without update", machineId);
                message.ack();
                return;
            }

            log.info("Processing package-managers report: machineId={} packageManagers={}", machineId, packageManagers);
            packageManagersService.apply(machineId, packageManagers);

            message.ack();
        } catch (JsonProcessingException | IllegalArgumentException permanentlyBad) {
            log.warn("Dropping malformed package-managers report subject={} payload={}", subject, payload, permanentlyBad);
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing package-managers report: {}", payload, e);
        }
    }
}
