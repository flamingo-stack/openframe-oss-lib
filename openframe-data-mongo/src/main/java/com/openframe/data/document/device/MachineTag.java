package com.openframe.data.document.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "machine_tags")
@CompoundIndexes({
        @CompoundIndex(name = "machine_tag_idx", def = "{'machineId': 1, 'tagId': 1}", unique = true)
})
public class MachineTag {
    @Id
    private String id;

    private String machineId;
    private String tagId;

    /**
     * Per-device values for the tag key (e.g., ["site1", "site2"] for key "site").
     * Empty list for simple label tags with no values.
     */
    private List<String> values;

    private Instant taggedAt;
    private String taggedBy;
}