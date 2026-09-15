package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ClientUninstallDeliverySpec implements DeliverySpec<ClientUninstallMessage> {

    private final ClientUninstallNatsPublisher publisher;
    private final MachineRepository machineRepository;

    @Override
    public DeliveryKind getKind() {
        return DeliveryKind.CLIENT_UNINSTALL;
    }

    @Override
    public Class<ClientUninstallMessage> getPayloadClass() {
        return ClientUninstallMessage.class;
    }

    @Override
    public void publish(String machineId, ClientUninstallMessage payload) {
        publisher.publish(machineId, payload);
    }

    // the agent never ran the uninstall: keep the machine visible instead of parking it in PENDING_DELETION forever
    @Override
    public void onFailed(MachineDelivery delivery, DeliveryFailure failure) {
        String machineId = delivery.getMachineId();
        machineRepository.findByMachineId(machineId)
                .filter(ClientUninstallDeliverySpec::isPendingDeletion)
                .ifPresent(this::restoreOffline);
    }

    private void restoreOffline(Machine machine) {
        machine.setStatus(DeviceStatus.OFFLINE);
        machineRepository.save(machine);
    }

    private static boolean isPendingDeletion(Machine machine) {
        return machine.getStatus() == DeviceStatus.PENDING_DELETION;
    }
}
