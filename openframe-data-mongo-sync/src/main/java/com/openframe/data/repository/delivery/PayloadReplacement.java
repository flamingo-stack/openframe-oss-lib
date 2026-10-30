package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryStatus;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.Set;

// a new body for a row the agent has not received yet: the row's next dispatch, due at once
@Value
@Builder
public class PayloadReplacement {

    String id;
    Set<DeliveryStatus> from;
    String dispatchId;
    String payloadId;
    String nextDispatchId;
    Instant dueAt;
}
