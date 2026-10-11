package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
@Schema(description = "Tool filter options")
public class ToolFilterResponse {
    @Schema(description = "Available tool types") private final List<String> types;
    @Schema(description = "Available tool categories") private final List<String> categories;
    @Schema(description = "Available platform categories") private final List<String> platformCategories;
}

