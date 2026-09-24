package com.openframe.data.document.delivery;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "machine_delivery")
@CompoundIndex(name = "machine_delivery_due", def = "{'tenantId': 1, 'status': 1, 'dueAt': 1}")
public class MachineDelivery implements TenantScoped {

    @Id
    private String id;

    private DeliveryType type;
    private String targetId;
    private String machineId;
    private String tenantId;

    private DeliveryStatus status;
    private int attempts;
    private int errors;
    private String dispatchId;
    private String payloadJson;

    private Instant dispatchedAt;
    private Instant dueAt;
    private Instant ackedAt;
    private Instant finishedAt;

    private DeliveryFailure failure;
    private String error;

    @Indexed(name = "machine_delivery_ttl", expireAfterSeconds = 0)
    private Instant expiresAt;
}
