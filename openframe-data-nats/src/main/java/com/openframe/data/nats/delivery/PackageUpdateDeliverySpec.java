package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.packageupdate.PackageUpdateMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class PackageUpdateDeliverySpec implements DeliverySpec<PackageUpdateDeliverySeed, PackageUpdateMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.package-update";

    @Override
    public DeliveryType getType() {
        return DeliveryType.PACKAGE_UPDATE;
    }

    @Override
    public Class<PackageUpdateMessage> getPayloadClass() {
        return PackageUpdateMessage.class;
    }

    @Override
    public DeliveryRequest<PackageUpdateMessage> request(PackageUpdateDeliverySeed seed) {
        PackageUpdateMessage message = new PackageUpdateMessage();
        message.setRequestId(seed.getRequestId());
        message.setSource(seed.getSource());
        message.setPackageRef(seed.getPackageRef());
        message.setMode(seed.getMode());
        message.setCountdownSeconds(seed.getCountdownSeconds());
        return DeliveryRequest.<PackageUpdateMessage>builder()
                .type(DeliveryType.PACKAGE_UPDATE)
                .targetId(seed.getTargetId())
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }
}
