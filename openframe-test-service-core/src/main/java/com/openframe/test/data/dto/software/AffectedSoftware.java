package com.openframe.test.data.dto.software;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One software title a CVE hits, as listed on the vulnerability detail page.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AffectedSoftware {
    private String id;
    private String name;
    private String source;
    private String version;
    private Integer devicesCount;
    private Integer customersCount;
    private String resolvedInVersion;
}
