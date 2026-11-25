package com.openframe.data.document.device.chocolatey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChocolateyDecision {

    private ChocolateyAdminOption option;
    private String reason;
    private Instant decidedAt;
    private String decidedBy;
    private boolean upgradeRetryPending;
}
