package com.openframe.data.document.version;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Release version document representing application version information.
 */
@Data
@Document(collection = "release_versions")
public class ReleaseVersion {

    @Id
    private String id;

    /**
     * Version string (e.g., "4.2.0", "1.0.0-beta")
     */
    @Indexed
    private String version;

    /**
     * Timestamp when this version was created
     */
    @CreatedDate
    private Instant createdAt;

    /**
     * Timestamp when this version was last updated
     */
    @LastModifiedDate
    private Instant updatedAt;
}

