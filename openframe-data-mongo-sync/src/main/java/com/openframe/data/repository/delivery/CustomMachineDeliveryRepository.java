package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;

import java.time.Instant;
import java.util.Set;

public interface CustomMachineDeliveryRepository {

    boolean markRepublished(String id, Set<DeliveryStatus> from, Instant attemptAt, Instant dueAt);

    boolean postpone(String id, Set<DeliveryStatus> from, Instant dueAt);

    boolean markAcked(String id, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt);

    boolean markDone(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    boolean markCancelled(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    boolean markFailed(String id, Set<DeliveryStatus> from, DeliveryFailure failure, Instant finishedAt, Instant expiresAt);

    long wake(String machineId, Set<DeliveryStatus> from, Instant dueAt);
}
