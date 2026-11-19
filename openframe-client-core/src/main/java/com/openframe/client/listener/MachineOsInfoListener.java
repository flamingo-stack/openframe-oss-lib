package com.openframe.client.listener;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.openframe.client.service.MachineOsInfoService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.model.MachineOsInfoMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@Slf4j
public class MachineOsInfoListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final MachineOsInfoService machineOsInfoService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    public MachineOsInfoListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            MachineOsInfoService machineOsInfoService,
            NatsTopicMachineIdExtractor machineIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.machineOsInfoService = machineOsInfoService;
        this.machineIdExtractor = machineIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return MachineOsInfoMessage.STREAM;
    }

    @Override
    protected String getSubject() {
        return MachineOsInfoMessage.SUBJECT_FILTER;
    }

    @Override
    protected String getConsumerName() {
        return "machine-os-info-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "machine-os-info";
    }

    @Override
    protected String getDeliverySubject() {
        return "machine.os-info.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String payload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();
        String machineId;
        MachineOsInfoMessage osInfo;
        try {
            machineId = machineIdExtractor.extract(subject);
            osInfo = objectMapper.readValue(payload, MachineOsInfoMessage.class);
        } catch (JacksonException | IllegalArgumentException permanentlyBad) {
            log.warn("Dropping malformed OS info subject={} payload={}", subject, payload, permanentlyBad);
            message.ack();
            return;
        }
        String osVersion = osInfo.getOsVersion();
        if (isBlank(osVersion)) {
            log.warn("OS info message without a version for machineId={}, acking without update", machineId);
            message.ack();
            return;
        }
        try {
            log.info("Processing OS info: machineId={} osVersion={} osBuild={}", machineId, osVersion, osInfo.getOsBuild());
            machineOsInfoService.updateOsInfo(machineId, osVersion, osInfo.getOsBuild());
            message.ack();
        } catch (Exception e) {
            log.error("Unexpected error processing OS info: {}", payload, e);
        }
    }
}
