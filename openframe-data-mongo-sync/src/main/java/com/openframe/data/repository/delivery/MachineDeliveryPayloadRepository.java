package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.MachineDeliveryPayload;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@TenantAwareRepository
public interface MachineDeliveryPayloadRepository extends MongoRepository<MachineDeliveryPayload, String> {

    // primary on purpose: the sweep reads a body milliseconds after another pod wrote it
    @ReadPreference("primary")
    Optional<MachineDeliveryPayload> findHeldById(String id);
}
