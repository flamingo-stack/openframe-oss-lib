package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstalledOsUpdateDevice {

    // The key the aggregation groups by.
    @Id
    private String machineId;
    // The device's latest successful install of the update.
    private Instant installedAt;
}
