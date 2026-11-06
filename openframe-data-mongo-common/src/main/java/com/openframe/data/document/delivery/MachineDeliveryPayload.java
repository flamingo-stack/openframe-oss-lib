package com.openframe.data.document.delivery;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// the body of a delivery, one document per distinct content of a type within a tenant: the rows of a rollout, or of
// one script batch sent to a fleet, point here instead of each carrying a copy. Lives as long as the longest row
// pointing at it; the delivery block of a row is not part of the body, it is stamped when the row is published
@Data
@Document(collection = "machine_delivery_payload")
public class MachineDeliveryPayload implements TenantScoped {

    @Id
    private String id;
    private String tenantId;

    private DeliveryType type;
    private String payloadJson;

    @Indexed(name = "machine_delivery_payload_ttl", expireAfterSeconds = 0)
    private Instant expiresAt;
}
