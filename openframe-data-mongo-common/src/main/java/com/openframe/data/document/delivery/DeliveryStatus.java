package com.openframe.data.document.delivery;

import java.util.Set;

public enum DeliveryStatus {
    PENDING,
    ACKED,
    DONE,
    FAILED,
    CANCELLED;

    public static final Set<DeliveryStatus> UNACKED = Set.of(PENDING);
    public static final Set<DeliveryStatus> AWAITING_RESULT = Set.of(ACKED);
    public static final Set<DeliveryStatus> OPEN = Set.of(PENDING, ACKED);
    public static final Set<DeliveryStatus> COMPLETABLE = Set.of(PENDING, ACKED, FAILED);
}
