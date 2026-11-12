package com.openframe.data.repository.rmm.software;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.util.Collection;

// The titles of a tenant that at least one device has, narrowed by a lower-case fragment of the name, to the ones with
// CVEs, and to the ones a package manager manages (true) or does not (false); null leaves a dimension open. A title is
// managed when its Fleet source is one of managerSources (that manager installed it) or its stored match found a package.
@Getter
@AllArgsConstructor
@EqualsAndHashCode
public class SoftwareTitleQuery {
    private final String tenantId;
    private final String nameLower;
    private final boolean vulnerableOnly;
    private final Boolean manageable;
    private final Collection<String> managerSources;
}
