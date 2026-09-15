package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.nats.publisher.ToolInstallationNatsPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolInstallationDeliverySpec implements DeliverySpec<ToolInstallationMessage> {

    private final ToolInstallationNatsPublisher publisher;

    @Override
    public DeliveryKind getKind() {
        return DeliveryKind.TOOL_INSTALLATION;
    }

    @Override
    public Class<ToolInstallationMessage> getPayloadClass() {
        return ToolInstallationMessage.class;
    }

    @Override
    public void publish(String machineId, ToolInstallationMessage payload) {
        publisher.publish(machineId, payload);
    }

    @Override
    public void onFailed(MachineDelivery delivery, DeliveryFailure failure) {
        // nothing beyond FAILED + metric: an install is safe to re-run by hand
    }
}
