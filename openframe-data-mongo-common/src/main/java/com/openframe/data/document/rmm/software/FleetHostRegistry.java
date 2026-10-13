package com.openframe.data.document.rmm.software;

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
@Document(collection = "fleet_host_registry")
@CompoundIndex(name = "tenant_machine", def = "{'tenantId': 1, 'machineId': 1}", unique = true)
public class FleetHostRegistry {

    @Id
    private String id;

    @Indexed(unique = true)
    private Long fleetHostId;

    private String tenantId;

    private String machineId;

    private String resolvedVia;

    private Long fleetTeamId;

    private Instant firstSeenAt;

    private Instant updatedAt;
}
