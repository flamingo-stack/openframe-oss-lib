package com.openframe.external.dto.device;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Tag filter item with count")
public record TagFilterItem(
        @Schema(description = "Tag key", example = "environment") String key,
        @Schema(description = "Tag value", example = "production") String value,
        @Schema(description = "Count of devices with this tag", example = "15") Integer count
) {
}
