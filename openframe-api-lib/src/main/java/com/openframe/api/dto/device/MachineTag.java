package com.openframe.api.dto.device;

import com.openframe.data.document.tag.Tag;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

// A device's tag assignment: id is the assignment's (unique per device and tag), tag is the stored definition.
@Value
@Builder
public class MachineTag {
    String id;
    Tag tag;
    List<String> values;
    Instant taggedAt;
    String taggedBy;
}
