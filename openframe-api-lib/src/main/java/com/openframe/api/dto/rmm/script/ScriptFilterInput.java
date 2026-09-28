package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
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
    private List<OsType> supportedPlatforms;

    /** Match scripts assigned ANY of these tag ids (real {@code Tag} entities). */
    private List<String> tagIds;

    /** Match scripts created by ANY of these users — raw {@code createdBy} ids (not Relay-encoded). */
    private List<String> authorIds;
}
