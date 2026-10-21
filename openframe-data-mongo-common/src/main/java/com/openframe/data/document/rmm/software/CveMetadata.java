package com.openframe.data.document.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "cve_metadata")
public class CveMetadata {

    @Id
    private String id;

    @Indexed(unique = true)
    private String cveId;

    private String severity;

    private Double cvssScore;

    private String cvssVector;

    private Double epssProbability;

    private Boolean cisaKnownExploit;

    private Instant publishedAt;

    private Instant lastModifiedAt;

    private String description;

    private String detailsLink;

    private String cweId;

    private String source;

    private Instant cachedAt;
}
