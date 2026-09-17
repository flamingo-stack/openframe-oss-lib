package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.DeliveryRequest;
import com.openframe.delivery.DeliverySeed;
import com.openframe.delivery.DeliverySpec;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ClientUninstallDeliverySpec implements DeliverySpec<ClientUninstallDeliverySpec.Seed, ClientUninstallMessage> {

    // the target is the OpenFrame client itself, under the agentType it reports in installed-agent
    public static final String CLIENT_AGENT_TYPE = "openframe-client";

    private final ClientUninstallNatsPublisher publisher;
    private final MachineRepository machineRepository;

    @Getter
    @AllArgsConstructor
    public static class Seed implements DeliverySeed {
        private final String machineId;

        @Override
        public DeliveryType type() {
            return DeliveryType.CLIENT_UNINSTALL;
        }
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_UNINSTALL;
    }

    @Override
    public Class<Seed> getSeedClass() {
        return Seed.class;
    }

    @Override
    public Class<ClientUninstallMessage> getPayloadClass() {
        return ClientUninstallMessage.class;
    }

    @Override
    public DeliveryRequest<ClientUninstallMessage> request(Seed seed) {
        ClientUninstallMessage message = publisher.buildMessage();
        return DeliveryRequest.<ClientUninstallMessage>builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .targetId(CLIENT_AGENT_TYPE)
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
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
