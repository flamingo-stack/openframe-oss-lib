package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Data-layer filter criteria for {@code Script} queries. Mirrors the API-layer
 * {@code ScriptFilterInput} but lives here so the repository can stay
 * dependency-free of the API module. The service layer maps between the two.
 *
 * <p>Mirrors the {@code OrganizationQueryFilter} pattern.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptQueryFilter {

    private List<ScriptShell> shells;
    private List<ScriptStatus> statuses;
    private List<ScriptPlatform> supportedPlatforms;
    private String tag;
}
