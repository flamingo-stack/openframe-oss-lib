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
@Document(collection = "os_updates")
@CompoundIndex(
        name = "tenant_platform_identifier",
        def = "{'tenantId': 1, 'platform': 1, 'identifier': 1}",
        unique = true)
@CompoundIndex(
        name = "tenant_first_seen",
        def = "{'tenantId': 1, 'firstSeenAt': -1, '_id': -1}")
public class OsUpdate implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private OsPlatform platform;

    // Opaque: stored and joined on exactly as the agent sent it.
    private String identifier;

    private String displayName;

    private String displayVersion;

    private List<String> kbArticleIds;

    private OsUpdateSeverity severity;

    private List<String> categories;
    // Category names follow the language of the device, the ids do not.
    private List<String> categoryIds;
    private OsUpdateType updateType;
    private OsUpdateClassification classification;

    private List<String> cveIds;

    private Instant publishedAt;

    private Long sizeBytes;

    private OsUpdateRebootBehavior rebootBehavior;

    private Boolean browseOnly;

    private Instant firstSeenAt;
}
