package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.Data;

import java.util.List;

@Data
public class SoftwareActionFilterInput {

    private List<SoftwareActionStatus> statuses;
    private List<SoftwareAction> actions;
    private List<PackageManagerType> engines;
}
