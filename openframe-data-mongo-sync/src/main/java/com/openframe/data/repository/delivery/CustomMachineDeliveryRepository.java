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

    boolean markRepublished(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant attemptAt, Instant dueAt);

    boolean postpone(String id, Set<DeliveryStatus> from, Instant dueAt);

    boolean park(String id, Set<DeliveryStatus> from, Instant dueAt);

    boolean markAcked(String id, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt);

    boolean markDone(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    boolean markCancelled(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    boolean markFailed(String id, Set<DeliveryStatus> from, DeliveryFailure failure, Instant finishedAt, Instant expiresAt);

    long wake(String machineId, Set<DeliveryStatus> from, Instant dueAt);
}
