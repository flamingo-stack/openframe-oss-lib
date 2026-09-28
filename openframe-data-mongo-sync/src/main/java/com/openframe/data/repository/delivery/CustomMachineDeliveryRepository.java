package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;

import java.time.Instant;
import java.util.List;
import java.util.Set;

public interface CustomMachineDeliveryRepository {

    List<MachineDelivery> findDue(DeliveryStatus status, Instant before, int limit);

    void upsertPending(MachineDelivery delivery);

    boolean markRepublished(String id, Set<DeliveryStatus> from, Instant dispatchedAt, int attempts, Instant dueAt);

    boolean postpone(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant dueAt);

    boolean postponeAfterError(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant dueAt);


    boolean markAcked(String id, String dispatchId, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt);

    boolean markDone(String id, String dispatchId, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    boolean markCancelled(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    boolean markCancelled(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant finishedAt, Instant expiresAt);

    boolean markFailed(String id, Set<DeliveryStatus> from, Instant dispatchedAt, DeliveryFailure failure, Instant finishedAt, Instant expiresAt);
    boolean markFailed(String id, String dispatchId, Set<DeliveryStatus> from, DeliveryFailure failure, String error, Instant finishedAt, Instant expiresAt);

}
