package com.openframe.data.document.rmm.osupdate;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "os_update_policies")
@CompoundIndex(name = "tenant_created", def = "{'tenantId': 1, 'createdAt': 1}")
public class OsUpdatePolicy implements TenantScoped {

    @Id
    private String id;

    @Version
    private Long version;

    private String tenantId;

    private String name;

    private OsUpdatePolicyTarget target;

    // An urgency without a rule is not rolled out by the policy.
    private Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules;

    private Map<OsUpdateUrgency, OsUpdateRestartDeadline> restartDeadlines;

    // The devices with this tag are the pilot ring. Null = the policy has no pilot ring.
    private String pilotTagId;

    // Downloads happen any time; installs and restarts only inside the window of the device class.
    private Map<OsUpdateDeviceClass, OsUpdateMaintenanceWindow> maintenanceWindows;

    private OsUpdateOfflineRule offlineRule;

    private OsUpdateInUseRule inUseRule;

    // A domain controller installs in the server window and restarts only when a technician tells it to.
    private boolean domainControllerRestartManual;

    private Map<OsUpdateDeviceClass, OsUpdateRestartMode> restartModes;

    private OsUpdateRestartDialog restartDialog;

    // WARNING: breaks the tie between two policies of one target type that cover the same device, the earlier
    // one applies; never moved by an update
    private Instant createdAt;

    private Instant updatedAt;
}
