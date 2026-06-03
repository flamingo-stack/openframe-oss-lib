package com.openframe.data.document.version;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "release_versions")
public class ReleaseVersion implements TenantScoped {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    @Version
    private Long documentVersion;

    @Indexed
    private String version;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
