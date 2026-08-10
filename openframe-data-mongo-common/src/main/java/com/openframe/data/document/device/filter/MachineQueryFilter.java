package com.openframe.data.document.device.filter;

import com.openframe.data.document.rmm.OsType;
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
    private List<OsType> osTypes;
    private List<String> organizationIds;
    private List<OsType> platformNames;
    private Collection<String> restrictToMachineIds;
}
