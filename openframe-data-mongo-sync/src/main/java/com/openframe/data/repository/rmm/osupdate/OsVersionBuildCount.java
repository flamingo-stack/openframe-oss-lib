package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsVersionBuildCount {

    private String osBuild;
    private long deviceCount;
}
