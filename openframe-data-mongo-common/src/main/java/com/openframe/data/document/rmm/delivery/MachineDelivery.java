package com.openframe.data.document.rmm.delivery;

import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
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
@CompoundIndex(name = "machine_delivery_sweep", def = "{'kind': 1, 'status': 1, 'lastAttemptAt': 1}")
public class MachineDelivery {

    private static final String ID_SEPARATOR = ":";

    @Id
    private String id;

    private DeliveryKind kind;
    private String targetId;
    private String machineId;
    private String tenantId;

    private DeliveryStatus status;
    private int attempts;
    private String payloadJson;

    private Instant dispatchedAt;
    private Instant lastAttemptAt;
    private Instant ackedAt;
    private Instant finishedAt;

    private DeliveryFailure failure;
    private String error;

    private ScheduleOfflineBehavior offlineBehavior;
    private Long reconnectWindowSeconds;

    @Indexed(name = "machine_delivery_ttl", expireAfterSeconds = 0)
    private Instant expiresAt;

    public static String id(DeliveryKind kind, String targetId, String machineId) {
        return kind.name() + ID_SEPARATOR + targetId + ID_SEPARATOR + machineId;
    }
}
