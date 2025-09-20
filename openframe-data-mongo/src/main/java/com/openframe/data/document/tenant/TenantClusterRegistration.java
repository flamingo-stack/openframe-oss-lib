package com.openframe.data.document.tenant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "tenant_cluster_registrations")
public class TenantClusterRegistration {

    @Id
    private String clusterId;

    @Indexed(unique = true)
    private String internalDns;

    @Indexed(unique = true, sparse = true)
    private String tenantId;
}
