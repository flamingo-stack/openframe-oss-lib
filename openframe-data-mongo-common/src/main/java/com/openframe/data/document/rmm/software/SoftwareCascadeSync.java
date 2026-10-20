package com.openframe.data.document.rmm.software;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "software_cascade_sync")
@CompoundIndex(name = "pending_by_created", def = "{'status': 1, 'createdAt': 1}")
public class SoftwareCascadeSync {

    @Id
    private String id;

    private CascadeSyncType type;

    private Long softwareId;

    private Long osId;

    private DeviceOnlineDispatchStatus status;

    private Instant createdAt;

    private Instant processedAt;

    public static String idFor(CascadeSyncType type, Long key) {
        return type.name() + ":" + key;
    }
}
