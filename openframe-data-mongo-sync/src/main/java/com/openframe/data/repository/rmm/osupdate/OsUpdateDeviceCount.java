package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateDeviceCount {

    // The key the aggregation groups by.
    @Id
    private String identifier;
    private long deviceCount;
}
