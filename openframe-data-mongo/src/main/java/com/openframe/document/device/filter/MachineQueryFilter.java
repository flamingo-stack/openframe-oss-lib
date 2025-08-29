package com.openframe.document.device.filter;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MachineQueryFilter {
    private List<String> statuses;
    private List<String> deviceTypes;
    private List<String> osTypes;
    private List<String> organizationIds;
    private List<String> tagNames;
} 