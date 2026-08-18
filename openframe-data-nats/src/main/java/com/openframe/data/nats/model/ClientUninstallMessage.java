package com.openframe.data.nats.model;

import lombok.Data;

@Data
public class ClientUninstallMessage {

    /**
     * When the command was issued (ISO-8601 instant). Lets the agent ignore
     * stale commands replayed from the stream, e.g. after a reinstall.
     */
    private String issuedAt;

}
