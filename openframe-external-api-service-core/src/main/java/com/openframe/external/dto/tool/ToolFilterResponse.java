package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Tool filter options")
public record ToolFilterResponse(
        @Schema(description = "Available tool types") List<String> types,
        @Schema(description = "Available tool categories") List<String> categories,
        @Schema(description = "Available platform categories") List<String> platformCategories
) {
}
