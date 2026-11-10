package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.vulnerability.AffectedSoftwareResponse;
import com.openframe.core.util.SoftwareNames;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
public class SoftwareNameDataFetcher {

    @DgsData(parentType = "Software", field = "name")
    public String softwareName(DgsDataFetchingEnvironment dfe) {
        SoftwareResponse software = dfe.getSource();
        return SoftwareNames.displayName(software.getName(), software.getBundleIdentifier());
    }

    @DgsData(parentType = "AffectedSoftware", field = "name")
    public String affectedSoftwareName(DgsDataFetchingEnvironment dfe) {
        AffectedSoftwareResponse software = dfe.getSource();
        return SoftwareNames.displayName(software.getName(), software.getBundleIdentifier());
    }
}
