package com.openframe.data.repository.device.publishing;

import com.openframe.publishing.api.spec.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// What consumers of events.machines see. A proposal until stage 0 settles the public fields.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MachineEvent implements PublishedEvent {

    // The business id tickets and insights reference, not the Mongo _id.
    private String machineId;
    private String hostname;
    private String nickname;
}
