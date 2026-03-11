package com.openframe.api.dto.device;

import com.openframe.data.document.tool.TagType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Composite DTO that merges Tag key definition with MachineTag per-device values.
 * Represents a tag as it appears on a specific device.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceTag {

    private String tagId;           // Tag.id
    private String key;             // Tag.key
    private TagType type;           // Tag.type
    private String description;     // Tag.description
    private String color;           // Tag.color
    private List<String> values;    // MachineTag.values
    private String organizationId;  // Tag.organizationId
    private Instant createdAt;      // MachineTag.createdAt
    private String createdBy;       // MachineTag.createdBy
}
