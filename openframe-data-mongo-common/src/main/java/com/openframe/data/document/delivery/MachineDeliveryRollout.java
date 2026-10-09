package com.openframe.data.document.delivery;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// one payload for every machine the type delivers to, handed out in batches by client-service; one document per
// (type, targetId): starting a rollout replaces the running one
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "machine_delivery_rollout")
public class MachineDeliveryRollout implements TenantScoped {

    @Id
    private String id;
    private String tenantId;

    private DeliveryType type;
    private String targetId;
    private String payloadJson;
    private int sequence;

    private DeliveryRolloutStatus status;
    private String cursor;
    private int dispatched;
    private Instant startedAt;
}
