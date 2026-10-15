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
@Document(collection = "fleet_software")
public class FleetSoftware {

    @Id
    private String id;

    @Indexed(unique = true)
    private Long softwareId;

    private Long softwareTitleId;

    private String name;

    private String version;

    private String source;

    private Instant updatedAt;
}
