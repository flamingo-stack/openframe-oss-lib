package com.openframe.data.document.rmm.osupdate;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// What the policy of a device and the technicians' overrides mean for one pending update of the device. Holds
// nothing of its own: it is calculated again on every run and can be dropped and rebuilt.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "device_os_update_rollout_states")
@CompoundIndex(
        name = "tenant_machine_identifier",
        def = "{'tenantId': 1, 'machineId': 1, 'identifier': 1}",
        unique = true)
@CompoundIndex(name = "tenant_install_from", def = "{'tenantId': 1, 'installFrom': 1}")
@CompoundIndex(name = "tenant_hard", def = "{'tenantId': 1, 'hardAt': 1}")
public class DeviceOsUpdateRolloutState implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;
    // The customer of the device at the last run. Null = the device has none.
    private String organizationId;

    private OsPlatform platform;

    private String identifier;

    private String policyId;

    // The override that decided. Null = the policy decided.
    private OsUpdateOverrideAction overrideAction;

    // The update is not installed before this moment. Null = it waits for a technician.
    private Instant installFrom;

    // The restart deadlines. Null while installFrom is null.
    private Instant focusAt;

    private Instant softAt;

    private Instant hardAt;
}
