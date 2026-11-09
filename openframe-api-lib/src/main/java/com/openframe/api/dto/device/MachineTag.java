package com.openframe.api.dto.device;

import com.openframe.data.document.tag.Tag;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

/**
 * A tag assigned to one device: the assignment's own id, values and tagged date, with the stored
 * tag definition under {@link #tag}. One instance per (device, tag), so clients that cache by id
 * never merge two devices' values.
 */
@Value
@Builder
public class MachineTag {
    /** Id of the tag assignment document, unique per (device, tag). */
    String id;
    /** The tag definition as stored: key, description, color, entity type and its own createdAt. */
    Tag tag;
    /** The device's values for the tag key; empty for a plain label. */
    List<String> values;
    Instant taggedAt;
    String taggedBy;
}
