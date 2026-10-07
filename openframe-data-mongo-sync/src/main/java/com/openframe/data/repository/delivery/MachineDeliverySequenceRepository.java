package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.MachineDeliverySequence;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;

@TenantAwareRepository
public interface MachineDeliverySequenceRepository extends MongoRepository<MachineDeliverySequence, String> {
}
