package com.openframe.test.data.dto.software;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Filter for softwares and deviceSoftware: package sources and a minSeverity cut-off (softwares honours only the cut-off).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SoftwareFilterInput {
    private List<String> sources;
    private String minSeverity;
}
