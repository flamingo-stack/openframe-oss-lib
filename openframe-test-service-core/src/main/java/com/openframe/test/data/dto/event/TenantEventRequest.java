package com.openframe.test.data.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Body of POST /api/events (saas-api TenantEventRequest); plain strings so a test can send a type or mode the service refuses.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantEventRequest {
    private String eventType;
    private String subtype;
    private String repeatMode;
}
