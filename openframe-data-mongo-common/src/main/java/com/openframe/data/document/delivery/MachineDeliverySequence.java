package com.openframe.data.document.delivery;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

// one document per tenant, the delivery engine's auto-increment; no TTL, a counter that restarts would make the agent
// drop the next dispatch as stale
@Data
@Document(collection = "machine_delivery_sequence")
public class MachineDeliverySequence implements TenantScoped {

    @Id
    private String id;
    private String tenantId;
    private int value;
}
