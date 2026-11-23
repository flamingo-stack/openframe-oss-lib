package com.openframe.management.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
class ChocoFeedCatalog {

    private List<Package> packages = List.of();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Package {

        private String id;
        private String version;
        private String reason;
        @JsonProperty("winget_id")
        private String wingetId;
    }
}
