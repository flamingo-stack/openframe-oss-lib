package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// levels are DEBUG/INFO/WARN/ERROR; from and to are inclusive ISO-8601 instants.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DeviceLogFilterInput {
    private List<String> levels;
    private List<String> contains;
    private List<String> excludes;
    private String from;
    private String to;
}
