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
public class OsUpdateRestartDialog {

    // In the order of the menu: the first one is what a dialog nobody answers picks. Empty = no deferrals.
    private List<OsUpdateDeferOption> deferOptions;
    private Integer autoAnswerMinutes;
    private boolean userMayScheduleRestart;
}
