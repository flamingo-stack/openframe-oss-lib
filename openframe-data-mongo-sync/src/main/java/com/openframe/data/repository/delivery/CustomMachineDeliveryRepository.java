package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;

import java.time.Instant;

public interface CustomMachineDeliveryRepository {

    boolean markRepublished(String id, Instant attemptAt, Instant nextAttemptAt);

    boolean postpone(String id, Instant nextAttemptAt);

    boolean markAcked(String id, Instant ackedAt);

    boolean markDone(String id, Instant finishedAt, Instant expiresAt);

    boolean markCancelled(String id, Instant finishedAt, Instant expiresAt);

    boolean markFailed(String id, DeliveryFailure failure, Instant finishedAt, Instant expiresAt);

    long wake(String machineId, Instant nextAttemptAt);
}
