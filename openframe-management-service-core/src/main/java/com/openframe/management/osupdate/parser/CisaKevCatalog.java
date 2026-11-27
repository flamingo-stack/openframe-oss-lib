package com.openframe.management.osupdate.parser;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
class CisaKevCatalog {

    @JsonProperty("vulnerabilities")
    private List<CisaKevVulnerability> cisaKevVulnerabilities;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class CisaKevVulnerability {

        @JsonProperty("cveID")
        private String cveId;
    }
}
