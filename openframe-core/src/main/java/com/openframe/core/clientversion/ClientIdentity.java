package com.openframe.core.clientversion;

import lombok.Value;

@Value
public class ClientIdentity {

    public static final String UNKNOWN_VERSION = "-";

    ClientKind kind;
    String shellVersion;
    String bundleVersion;

    public static ClientIdentity unknown() {
        return new ClientIdentity(ClientKind.UNKNOWN, UNKNOWN_VERSION, UNKNOWN_VERSION);
    }
}
