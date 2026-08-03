package com.openframe.data.document.device.filter;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collection;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MachineQueryFilter {
    private List<String> statuses;
    private List<String> deviceTypes;
    private List<String> osTypes;
    private List<String> organizationIds;
    private List<String> platformNames;
    private Collection<String> restrictToMachineIds;
}
