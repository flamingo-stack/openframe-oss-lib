package com.openframe.management.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
class ChocoFeedSearch {

    private List<Hit> data = List.of();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Hit {

        private String id;
        private String title;
        private String description;
        private String projectUrl;
    }
}
