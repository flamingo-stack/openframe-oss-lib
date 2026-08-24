package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Mirrors the API-layer ScriptFilterInput so the repository stays dependency-free of the API module.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptQueryFilter {

    private List<ScriptShell> shells;
    private List<ScriptStatus> statuses;
    private List<OsType> supportedPlatforms;

    // Resolved into matching script ids via the tag_assignments collection.
    private List<String> tagIds;

    // Filters by createdBy (author user id).
    private List<String> createdByIds;
}
