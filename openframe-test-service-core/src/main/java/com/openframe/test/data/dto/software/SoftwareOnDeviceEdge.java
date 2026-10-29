package com.openframe.test.data.dto.software;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One edge of a SoftwareOnDeviceConnection.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareOnDeviceEdge {
    private SoftwareOnDevice node;
    private String cursor;
}
