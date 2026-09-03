package com.openframe.data.document.rmm.schedule;

import com.openframe.data.document.TenantScoped;
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
@Document(collection = "schedule_local_machine_time_dispatch")
@CompoundIndex(name = "scheduleId_machineId", def = "{'scheduleId': 1, 'machineId': 1}", unique = true)
public class ScheduleLocalMachineTimeDispatch implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String scheduleId;

    private String machineId;

    private Instant firedAt;

    private ScheduleDeviceLocalTimeDispatchStatus status;
}
