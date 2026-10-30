package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryPayload;
import com.openframe.data.repository.delivery.MachineDeliveryPayloadRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

// one document per distinct body of a type within the tenant, written once; only its expiry moves, forward
@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryPayloadStore {

    private final MachineDeliveryPayloadRepository repository;
    private final TenantIdProvider tenants;

    // two pods holding the same new body at once both save it and the later save may carry the earlier expiry, by
    // the moment between the two: the margin the recorder adds to every row covers that
    public String hold(DeliveryType type, DeliveryPayloadBody body, Instant expiresAt) {
        String tenantId = tenants.getTenantId();
        String id = DeliveryId.payload(tenantId, type, body.hash());
        Optional<MachineDeliveryPayload> held = repository.findHeldById(id);
        if (held.filter(document -> isHeldUntil(document, expiresAt)).isPresent()) {
            return id;
        }
        MachineDeliveryPayload document = held.orElseGet(() -> newBody(id, type, body));
        document.setExpiresAt(expiresAt);
        repository.save(document);
        log.debug("Delivery payload body held: id={} expiresAt={} written={}", id, expiresAt, held.isEmpty());
        return id;
    }

    public Optional<String> find(String id) {
        return repository.findHeldById(id).map(MachineDeliveryPayload::getPayloadJson);
    }

    private static boolean isHeldUntil(MachineDeliveryPayload document, Instant expiresAt) {
        return !document.getExpiresAt().isBefore(expiresAt);
    }

    private static MachineDeliveryPayload newBody(String id, DeliveryType type, DeliveryPayloadBody body) {
        MachineDeliveryPayload document = new MachineDeliveryPayload();
        document.setId(id);
        document.setType(type);
        document.setPayloadJson(body.json());
        return document;
    }
}
