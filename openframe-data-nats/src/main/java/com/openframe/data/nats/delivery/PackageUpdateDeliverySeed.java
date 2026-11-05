package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.nats.packageupdate.UpdateSource;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder(toBuilder = true)
public class PackageUpdateDeliverySeed implements DeliverySeed {

    private static final String DEADLINE_SUFFIX = ":deadline";

    private final String machineId;
    private final String requestId;
    private final UpdateSource source;
    private final PackageReference packageRef;
    private final PackageUpdateMode mode;
    private final Integer countdownSeconds;
    private final boolean deadlineForce;

    public static String deadlineTargetId(String requestId) {
        return requestId + DEADLINE_SUFFIX;
    }

    public static boolean isDeadlineTarget(String targetId) {
        return targetId.endsWith(DEADLINE_SUFFIX);
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.PACKAGE_UPDATE;
    }

    @Override
    public String getTargetId() {
        return deadlineForce ? deadlineTargetId(requestId) : requestId;
    }

    @Override
    public String getMachineId() {
        return machineId;
    }
}
