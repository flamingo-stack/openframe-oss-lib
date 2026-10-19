package com.openframe.test.data.dto.shared;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One faceted filter option (value / label / count) as returned by the
// *Filters queries (ScriptFilterOption in the schema).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FilterOption {
    private String value;
    private String label;
    private Integer count;
}
