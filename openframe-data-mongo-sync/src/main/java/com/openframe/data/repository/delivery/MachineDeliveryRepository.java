package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface MachineDeliveryRepository extends MongoRepository<MachineDelivery, String> {

    List<MachineDelivery> findByTypeAndStatusAndLastAttemptAtBefore(DeliveryType type, DeliveryStatus status, Instant before);

    List<MachineDelivery> findByTypeAndStatusAndAckedAtBefore(DeliveryType type, DeliveryStatus status, Instant before);
}
