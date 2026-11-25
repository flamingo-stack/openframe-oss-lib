package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsVersionDeviceCounts {

    // The key the aggregation groups by.
    @Id
    private String osVersion;
    private List<OsVersionBuildCount> osVersionBuildCounts;
}
