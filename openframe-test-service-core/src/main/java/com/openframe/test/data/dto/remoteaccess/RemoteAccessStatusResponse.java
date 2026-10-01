package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// The machine-side REST answer of ack/approve on openframe-saas-client, also the 409 body of a settled request.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteAccessStatusResponse {
    private String requestId;
    private String status;
}
