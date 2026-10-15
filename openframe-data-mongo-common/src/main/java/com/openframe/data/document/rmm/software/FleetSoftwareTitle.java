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
@Document(collection = "fleet_software_title")
public class FleetSoftwareTitle {

    @Id
    private String id;

    @Indexed(unique = true)
    private Long softwareTitleId;

    private String name;

    private String nameLower;

    private String source;

    private String browser;

    private String bundleIdentifier;

    private Instant updatedAt;
}
