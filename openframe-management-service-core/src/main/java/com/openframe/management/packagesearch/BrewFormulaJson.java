package com.openframe.management.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
class BrewFormulaJson {

    private String name;
    private String desc;
    private String homepage;
    private String license;
    private List<String> aliases;
    private List<String> oldnames;
    private Versions versions;
    private Boolean disabled;

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Versions {
        private String stable;
    }
}
