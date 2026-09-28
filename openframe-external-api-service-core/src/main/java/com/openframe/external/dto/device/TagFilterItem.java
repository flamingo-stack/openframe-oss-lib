package com.openframe.external.dto.device;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "Tag filter item with count")
public class TagFilterItem {
    @Schema(description = "Tag key", example = "environment")
    private final String key;
    @Schema(description = "Tag value", example = "production")
    private final String value;
    @Schema(description = "Count of devices with this tag", example = "15")
    private final Integer count;
}
