package com.openframe.core.agentkey;

import java.time.Instant;

public record AgentLogKeyResponse(String key, Instant createdAt) {
}
