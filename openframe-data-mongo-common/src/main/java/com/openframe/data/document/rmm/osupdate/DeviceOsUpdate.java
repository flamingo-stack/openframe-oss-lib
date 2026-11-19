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
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "device_os_updates")
@CompoundIndex(
        name = "tenant_machine_update",
        def = "{'tenantId': 1, 'machineId': 1, 'updateKey': 1}",
        unique = true)
public class DeviceOsUpdate implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private String updateKey;

    private String title;

    private String version;

    private List<String> kbArticleIds;

    private OsUpdateSeverity severity;

    private List<DeviceOsUpdateCategory> categories;

    private Boolean browseOnly;

    private Instant publishedAt;

    private Long sizeBytes;

    private OsUpdateRestartBehaviour restartBehaviour;

    private Instant discoveredAt;
}
