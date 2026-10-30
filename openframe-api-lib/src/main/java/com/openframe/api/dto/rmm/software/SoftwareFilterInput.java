package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import lombok.Data;

import java.util.List;

@Data
public class SoftwareFilterInput {

    private List<SoftwareSource> sources;

    private List<SoftwareVersionStatus> versionStatuses;

    private SoftwareCveSeverity minSeverity;

    private List<String> deviceTagIds;

    private List<SoftwareAutoUpdateStatus> autoUpdateStatuses;
}
