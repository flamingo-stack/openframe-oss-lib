package com.openframe.management.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
class BrewCaskJson {

    private String token;
    private List<String> name;
    private String desc;
    private String homepage;
    private String version;
    @JsonProperty("old_tokens")
    private List<String> oldTokens;
    private Boolean disabled;
}
