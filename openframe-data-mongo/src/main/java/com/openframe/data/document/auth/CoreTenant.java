package com.openframe.data.document.auth;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@SuperBuilder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tenants")
public class CoreTenant {
    @Id
    private String id;

    /**
     * Tenant name (organization name).
     * Used primarily for display and identification.
     */
    @Indexed
    private String name;

    /**
     * Tenant domain (e.g. company.openframe.io)
     * Used for subdomain-based routing
     */
    @Indexed(unique = true)
    private String domain;
}
