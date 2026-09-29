package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

import static java.lang.String.format;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ClientUninstallDeliverySpec implements DeliverySpec<ClientUninstallDeliverySeed, ClientUninstallMessage> {

    private static final String TARGET_ID = "openframe-client";

    private static final String SUBJECT_TEMPLATE = "machine.%s.client-uninstall";

    private final MachineRepository machineRepository;

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_UNINSTALL;
    }

    @Override
    public Class<ClientUninstallMessage> getPayloadClass() {
        return ClientUninstallMessage.class;
    }

    @Override
    public String targetId(ClientUninstallDeliverySeed seed) {
        return TARGET_ID;
    }

    @Override
    public DeliveryRequest<ClientUninstallMessage> request(ClientUninstallDeliverySeed seed) {
        ClientUninstallMessage message = new ClientUninstallMessage();
        message.setIssuedAt(Instant.now().toString());
        return DeliveryRequest.<ClientUninstallMessage>builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .targetId(targetId(seed))
                .machineId(seed.machineId())
                .payload(message)
                .build();
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }

    // PENDING_DELETION stops status updates for the machine, so it is set only once the command is on the machine
    @Override
    public void onAcked(MachineDelivery delivery) {
        String machineId = delivery.getMachineId();
        machineRepository.findByMachineId(machineId).ifPresent(machine -> {
            DeviceStatus status = machine.getStatus();
            if (status == DeviceStatus.PENDING_DELETION || status == DeviceStatus.DELETED) {
                return;
            }
            machine.setStatus(DeviceStatus.PENDING_DELETION);
            machineRepository.save(machine);
            log.info("Machine {} marked PENDING_DELETION: uninstall acknowledged by the agent", machineId);
        });
    }

    // a machine still in PENDING_DELETION here was never uninstalled: hand it back, the next heartbeat sets ONLINE
    @Override
    public void onFailed(MachineDelivery delivery, DeliveryFailure failure) {
        String machineId = delivery.getMachineId();
        machineRepository.findByMachineId(machineId).ifPresent(machine -> {
            if (machine.getStatus() != DeviceStatus.PENDING_DELETION) {
                return;
            }
            machine.setStatus(DeviceStatus.OFFLINE);
            machineRepository.save(machine);
            log.error("Client uninstall failed after the agent acknowledged it, machine {} returned to OFFLINE: reason={} error={}",
                    machineId, failure, delivery.getError());
        });
    }
}
