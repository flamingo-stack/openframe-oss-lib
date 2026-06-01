package com.openframe.api.dto.script;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptFilterInput {

    /** Match scripts whose {@code shell} is in this set. */
    private List<ScriptShell> shells;

    /** Match scripts whose {@code status} is in this set. Default excludes DELETED when null/empty. */
    private List<ScriptStatus> statuses;

    /** Match scripts whose {@code supportedPlatforms} contains ANY of these platforms. */
    private List<ScriptPlatform> supportedPlatforms;

    /** Exact-match tag (case-insensitive). */
    private String tag;
}
