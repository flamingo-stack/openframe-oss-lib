package com.openframe.data.document.cluster;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Cluster registration document representing cluster image tag version information.
 */
@Data
@Document(collection = "cluster_registrations")
public class ClusterRegistration {

    @Id
    private String id;

    /**
     * Image tag version string (e.g., "4.2.0", "1.0.0-beta")
     */
    @Indexed
    private String imageTagVersion;

    /**
     * Timestamp when this cluster registration was created
     */
    @CreatedDate
    private Instant createdAt;

    /**
     * Timestamp when this cluster registration was last updated
     */
    @LastModifiedDate
    private Instant updatedAt;
}

