package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// the agent applies an enabled flag only from minVersion of itself on: a fix shipped under a flag never meets
// an older binary with the flag already on, whichever of the flags and the update reaches the machine first
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientFeatureFlag {

    private boolean enabled;
    private String minVersion;
}
