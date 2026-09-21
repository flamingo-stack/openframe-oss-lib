package com.openframe.data.document.delivery;

import java.util.EnumSet;
import java.util.Set;

public enum DeliveryStatus {
    PENDING,
    ACKED,
    DONE,
    FAILED,
    CANCELLED;

    public static final Set<DeliveryStatus> UNACKED = EnumSet.of(PENDING);
    public static final Set<DeliveryStatus> OPEN = EnumSet.of(PENDING, ACKED);
}
