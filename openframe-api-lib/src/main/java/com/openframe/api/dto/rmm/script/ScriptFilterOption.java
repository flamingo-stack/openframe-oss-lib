package com.openframe.api.dto.rmm.script;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One option for a scripts-list filter dropdown: the raw {@code value} to filter by,
 * a human {@code label} to show, and the {@code count} of matching scripts. Mirrors
 * {@code DeviceFilterOption}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptFilterOption {

    private String value;
    private String label;
    private Integer count;
}
