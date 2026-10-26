package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryStatus;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.Set;

// the first publish of a re-run: the row's next dispatch, written before the agent can answer to it
@Value
@Builder
public class RerunPublication {

    String id;
    Set<DeliveryStatus> from;
    Instant dispatchedAt;
    String dispatchId;
    String payloadJson;
    Instant publishedAt;
    Instant dueAt;
}
