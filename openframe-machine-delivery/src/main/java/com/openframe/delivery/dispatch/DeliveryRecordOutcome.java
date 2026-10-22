package com.openframe.delivery.dispatch;

public enum DeliveryRecordOutcome {
    RECORDED,
    // recorded for a machine that is not online: nothing is published, the sweep sends it once the machine shows up
    HELD,
    REPLAYED,
    OUTRANKED
}
