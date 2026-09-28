package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
@TenantAwareRepository
public interface MachineDeliveryRepository extends MongoRepository<MachineDelivery, String>, CustomMachineDeliveryRepository {
}
