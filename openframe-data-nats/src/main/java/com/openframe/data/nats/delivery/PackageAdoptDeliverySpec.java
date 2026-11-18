package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.PackageAdoptMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class PackageAdoptDeliverySpec implements DeliverySpec<PackageAdoptDeliverySeed, PackageAdoptMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.package-adopt";

    @Override
    public DeliveryType getType() {
        return DeliveryType.PACKAGE_ADOPT;
    }

    @Override
    public Class<PackageAdoptMessage> getPayloadClass() {
        return PackageAdoptMessage.class;
    }

    @Override
    public DeliveryRequest<PackageAdoptMessage> request(PackageAdoptDeliverySeed seed) {
        PackageAdoptMessage message = new PackageAdoptMessage();
        message.setRequestId(seed.getRequestId());
        message.setPackageRef(seed.getPackageRef());
        return DeliveryRequest.<PackageAdoptMessage>builder()
                .type(DeliveryType.PACKAGE_ADOPT)
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
