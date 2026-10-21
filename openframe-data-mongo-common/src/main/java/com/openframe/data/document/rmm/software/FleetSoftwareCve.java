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
@Document(collection = "fleet_software_cve")
@CompoundIndex(name = "software_cve", def = "{'softwareId': 1, 'cve': 1}", unique = true)
public class FleetSoftwareCve {

    @Id
    private String id;

    @Indexed
    private Long softwareId;

    private String cve;

    private String resolvedInVersion;

    private Instant updatedAt;
}
