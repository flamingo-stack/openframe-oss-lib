package com.openframe.data.repository.rmm.software;

import java.util.Collection;

// The titles of a tenant that at least one device has, narrowed by a lower-case fragment of the name, to the ones with
// CVEs, and to the ones a package manager manages (true) or does not (false); null leaves a dimension open. A title is
// managed when its Fleet source is one of managerSources (that manager installed it) or its stored match found a package.
public record SoftwareTitleQuery(String tenantId, String nameLower, boolean vulnerableOnly, Boolean manageable,
                                 Collection<String> managerSources) {
}
