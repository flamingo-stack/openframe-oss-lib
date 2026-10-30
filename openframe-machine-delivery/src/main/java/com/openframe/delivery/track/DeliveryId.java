package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.experimental.UtilityClass;

@UtilityClass
public class DeliveryId {

    private final String SEPARATOR = ":";

    public String of(DeliveryType type, String targetId, String machineId) {
        return type.name() + SEPARATOR + targetId + SEPARATOR + machineId;
    }

    // tenants share one database: a row is unique by its machine, a rollout of a target is unique only with the tenant
    public String rollout(String tenantId, DeliveryType type, String targetId) {
        return tenantId + SEPARATOR + type.name() + SEPARATOR + targetId;
    }

    // a body is unique by its content, within the tenant and type that sent it
    public String payload(String tenantId, DeliveryType type, String hash) {
        return tenantId + SEPARATOR + type.name() + SEPARATOR + hash;
    }
}
