package com.openframe.data.document.rmm.software;

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
@Document(collection = "device_operating_system")
@CompoundIndex(name = "tenant_machine", def = "{'tenantId': 1, 'machineId': 1}", unique = true)
public class DeviceOperatingSystem implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private Long hostId;

    @Indexed
    private Long osId;

    private String name;

    private String version;

    private String platform;

    private Instant updatedAt;
}
