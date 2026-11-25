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

// The latest security build of one OS version, by the vendor's bulletins.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "os_version_builds")
@CompoundIndex(
        name = "tenant_platform_os_version",
        def = "{'tenantId': 1, 'platform': 1, 'osVersion': 1}",
        unique = true)
public class OsVersionBuild implements TenantScoped {

    @Id
    private String id;

    @Version
    private Long version;

    private String tenantId;

    private OsPlatform platform;

    // As the agent reports it: "11 24H2".
    private String osVersion;

    // Build with its revision, as the agent reports osBuild: "26100.9974".
    private String latestBuild;

    // WARNING: the last refresh from the bulletins, also when the build stayed the same; the refresh interval
    // is counted from it
    private Instant updatedAt;
}
