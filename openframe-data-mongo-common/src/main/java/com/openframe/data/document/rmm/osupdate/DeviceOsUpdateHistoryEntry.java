package com.openframe.data.document.rmm.osupdate;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Duration;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "device_os_update_history")
@CompoundIndex(
        name = "tenant_machine_entry",
        def = "{'tenantId': 1, 'machineId': 1, 'entryKey': 1}",
        unique = true)
@CompoundIndex(
        name = "tenant_machine_installed",
        def = "{'tenantId': 1, 'machineId': 1, 'installedAt': -1, '_id': -1}")
public class DeviceOsUpdateHistoryEntry implements TenantScoped {

    // Counted from installedAt. The TTL index of the collection is created with this value, and an index that
    // already exists with another value is not changed by a new one: it has to be dropped first.
    public static final Duration RETENTION = Duration.ofDays(30);

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    // identifier + installedAt + operation: one install is one entry, however many reports repeat it.
    private String entryKey;

    private String identifier;

    private String title;

    private Instant installedAt;

    private OsUpdateOperation operation;

    private OsUpdateInstallResult result;

    private String errorCode;
}
