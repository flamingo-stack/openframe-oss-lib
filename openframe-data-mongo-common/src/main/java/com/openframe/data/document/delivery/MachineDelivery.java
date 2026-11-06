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
@CompoundIndex(name = "machine_delivery_type_due", def = "{'tenantId': 1, 'status': 1, 'type': 1, 'dueAt': 1}")
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
    // runs the row went through after its first: the policy's max-runs bounds reruns + 1
    private int reruns;
    private String dispatchId;
    private int sequence;
    // the body in machine_delivery_payload; rows written before that store carry their body inline in payloadJson
    // and are read that way until they expire
    private String payloadId;
    private String payloadJson;

    // the request's own rule for a machine that is not online; absent = the type's policy at sweep time
    private DeliveryOfflineBehavior offlineBehavior;
    private Long reconnectWindowSeconds;

    private Instant dispatchedAt;
    private Instant dueAt;
    private Instant ackedAt;
    private Instant finishedAt;

    private DeliveryFailure failure;
    private String error;

    @Indexed(name = "machine_delivery_ttl", expireAfterSeconds = 0)
    private Instant expiresAt;
}
