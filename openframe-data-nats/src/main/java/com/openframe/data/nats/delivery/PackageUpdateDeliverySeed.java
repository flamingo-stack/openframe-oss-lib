package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.nats.packageupdate.UpdateSource;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PackageUpdateDeliverySeed implements DeliverySeed {

    private static final String DEADLINE_SUFFIX = ":deadline";

    private final String machineId;
    private final String requestId;
    private final UpdateSource source;
    private final PackageReference packageRef;
    private final PackageUpdateMode mode;
    private final Integer countdownSeconds;
    // the force a WAIT escalates to at its deadline: scheduled while the WAIT still runs on the machine, so it takes a
    // delivery row of its own and the WAIT's row keeps its result, its re-run and its watchdog
    private final boolean deadlineForce;

    public static String deadlineTargetId(String requestId) {
        return requestId + DEADLINE_SUFFIX;
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
