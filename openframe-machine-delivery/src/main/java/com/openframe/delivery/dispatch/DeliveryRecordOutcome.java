package com.openframe.delivery.dispatch;

public enum DeliveryRecordOutcome {
    RECORDED,
    // recorded, nothing published now: the machine is not online or the delivery is due later, the sweep sends it
    HELD,
    REPLAYED,
    OUTRANKED
}
