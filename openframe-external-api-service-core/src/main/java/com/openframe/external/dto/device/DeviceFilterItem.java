package com.openframe.external.dto.device;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Device filter item with count")
public record DeviceFilterItem(
        @Schema(description = "Filter option value", example = "online") String value,
        @Schema(description = "Display label for the filter option", example = "Online") String label,
        @Schema(description = "Count of devices matching this filter option", example = "42") Integer count
) {
}
