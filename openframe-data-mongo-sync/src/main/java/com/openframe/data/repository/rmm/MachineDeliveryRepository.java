package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface MachineDeliveryRepository extends MongoRepository<MachineDelivery, String> {

    List<MachineDelivery> findByKindAndStatusAndLastAttemptAtBefore(DeliveryKind kind, DeliveryStatus status, Instant before);

    List<MachineDelivery> findByKindAndStatusAndAckedAtBefore(DeliveryKind kind, DeliveryStatus status, Instant before);
}
