package com.openframe.external.dto.shared;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Sort criteria for API requests")
public class SortCriteria {
    
    @Schema(description = "Field to sort by (e.g., eventTimestamp, severity, toolType)", example = "eventTimestamp")
    private String field;
    
    @Schema(description = "Sort direction (ASC or DESC)", example = "DESC", allowableValues = {"ASC", "DESC"})
    private String direction;
}