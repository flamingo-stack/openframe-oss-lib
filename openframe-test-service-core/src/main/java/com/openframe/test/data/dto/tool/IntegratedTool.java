package com.openframe.test.data.dto.tool;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class IntegratedTool {
    private String id;
    private String name;
    private String description;
    private String type;
    private String category;
    private String platformCategory;
    private Boolean enabled;
}
