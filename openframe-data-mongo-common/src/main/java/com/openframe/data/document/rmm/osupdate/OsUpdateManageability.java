package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateManageability {

    private OsUpdateManageabilityState state;

    // The agent's list is open: a reason this backend does not know yet is stored and shown as it came.
    private List<String> reasons;
}
