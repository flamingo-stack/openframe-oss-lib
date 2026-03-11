package com.openframe.external.dto.device;

import com.openframe.data.document.tool.TagType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO representing a tag as assigned to a device (key + values).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Tag assigned to a device with key-value data")
public class DeviceTagResponse {

    @Schema(description = "Tag definition ID", example = "tag-456")
    private String tagId;

    @Schema(description = "Tag key identifier", example = "site")
    private String key;

    @Schema(description = "Tag type classification", example = "CUSTOM")
    private TagType type;

    @Schema(description = "Tag description", example = "Physical location of the device")
    private String description;

    @Schema(description = "Tag color (hex code)", example = "#FF5733")
    private String color;

    @Schema(description = "Tag values assigned to this device", example = "[\"site1\", \"site2\"]")
    private List<String> values;

    @Schema(description = "Organization ID that owns this tag")
    private String organizationId;

    @Schema(description = "Timestamp when the tag was assigned to this device")
    private Instant createdAt;

    @Schema(description = "User ID who assigned the tag to this device")
    private String createdBy;
}
