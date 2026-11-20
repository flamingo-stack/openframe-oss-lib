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
    // a reinstall downloads the whole app: the usual 600 s closes a slow one as TIMEOUT while it still runs
    private static final long RESULT_TIMEOUT_SECONDS = 1800;

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
        message.setBundleId(seed.getBundleId());
        return DeliveryRequest.<PackageAdoptMessage>builder()
                .type(DeliveryType.PACKAGE_ADOPT)
                .targetId(seed.getTargetId())
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
    }

    @Override
    public Long getResultTimeoutSeconds() {
        return RESULT_TIMEOUT_SECONDS;
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }
}
