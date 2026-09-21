package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
@TenantAwareRepository
public interface MachineDeliveryRepository extends MongoRepository<MachineDelivery, String>, CustomMachineDeliveryRepository {

    List<MachineDelivery> findByStatusAndDueAtBefore(DeliveryStatus status, Instant before, Pageable page);
}
