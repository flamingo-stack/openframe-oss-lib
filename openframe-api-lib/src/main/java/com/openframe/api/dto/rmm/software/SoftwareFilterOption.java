package com.openframe.api.dto.rmm.software;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SoftwareFilterOption {

    private String value;
    private String label;
    private int count;
}
