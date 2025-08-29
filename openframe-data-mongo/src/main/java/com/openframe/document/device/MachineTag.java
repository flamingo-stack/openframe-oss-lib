package com.openframe.document.device;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "machine_tags")
@CompoundIndexes({
        @CompoundIndex(name = "machine_tag_idx", def = "{'machineId': 1, 'tagId': 1}", unique = true)
})
public class MachineTag {
    @Id
    private String id;

    private String machineId;
    private String tagId;

    private Instant taggedAt;
    private String taggedBy;
}