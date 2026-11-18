package com.openframe.core.agentkey;

import java.time.Instant;

public record AgentKeyResponse(String key, Instant createdAt) {
}
