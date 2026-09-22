package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SoftwareActionQueryFilter {

    private List<SoftwareActionStatus> statuses;
    private List<SoftwareAction> actions;
    private List<PackageManagerType> engines;
}
