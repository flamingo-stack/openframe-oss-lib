package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LastOsInstall {

    private String identifier;

    private String displayName;

    private String displayVersion;

    private Instant installedAt;
}
