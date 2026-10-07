package com.openframe.data.document.delivery;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

// one counter per delivery row key; it has no TTL on purpose, a counter that restarts after the row expired would make
// the agent drop the next dispatch as stale
@Data
@Document(collection = "machine_delivery_sequence")
public class MachineDeliverySequence implements TenantScoped {

    @Id
    private String id;
    private String tenantId;
    @Indexed
    private String machineId;
    private int value;
}
