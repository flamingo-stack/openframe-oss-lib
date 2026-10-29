package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryType;

import java.time.Instant;
import java.util.Optional;

public interface MachineDeliveryPayloadRepository {

    // the id of the tenant's document holding this body: written on first use, kept at least until expiresAt
    String hold(DeliveryType type, String hash, String payloadJson, Instant expiresAt);

    Optional<String> findJsonOnPrimary(String id);
}
