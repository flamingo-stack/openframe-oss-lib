package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class VulnerabilitiesResponse {

    private List<Vulnerability> vulnerabilities;

    private Long count;

    @JsonProperty("counts_updated_at")
    private String countsUpdatedAt;

    private Meta meta;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Meta {

        @JsonProperty("has_next_results")
        private Boolean hasNextResults;

        @JsonProperty("has_previous_results")
        private Boolean hasPreviousResults;
    }
}
