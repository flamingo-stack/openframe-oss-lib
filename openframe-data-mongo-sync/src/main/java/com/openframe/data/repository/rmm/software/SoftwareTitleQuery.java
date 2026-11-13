package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.util.Collection;

// The titles of a tenant that at least one device has, narrowed by a lower-case fragment of the name, to the ones with
// CVEs, and to the ones a package manager manages (true) or does not (false); null leaves a dimension open. A title is
// managed when its Fleet source is one of managerSources (that manager installed it) or its stored match found a package.
// osSources keeps the titles of those Fleet sources. installerSources keeps the titles of those Fleet sources, the
// matched ones (matchedChosen) and the ones no manager manages (unmanagedChosen). autoUpdateStatuses reads the ids of
// the titles with an enabled auto-update policy and of the ones with any policy.
@Getter
@Builder
@EqualsAndHashCode
public class SoftwareTitleQuery {
    private final String tenantId;
    private final String nameLower;
    private final boolean vulnerableOnly;
    private final Boolean manageable;
    private final Collection<String> managerSources;
    private final Collection<String> osSources;
    private final Collection<String> installerSources;
    private final boolean matchedChosen;
    private final boolean unmanagedChosen;
    private final Collection<SoftwareAutoUpdateStatus> autoUpdateStatuses;
    private final Collection<Long> enabledPolicyTitleIds;
    private final Collection<Long> policyTitleIds;
}
