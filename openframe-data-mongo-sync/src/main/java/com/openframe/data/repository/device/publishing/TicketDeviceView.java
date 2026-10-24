package com.openframe.data.repository.device.publishing;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

// The ticket fields MachineOnTicketsProjection reconciles; the job reads only these. Names are Ticket's properties.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TicketDeviceView {

    @Id
    private String id;
    private String tenantId;
    private String deviceId;
    private String deviceHostname;
}
