package com.openframe.test.data.dto.featureflag;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One effective frontend flag: the tenant's stored override if it has one, else the yml default, else false.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FeFeatureFlag {
    private String name;
    private Boolean enabled;
}
