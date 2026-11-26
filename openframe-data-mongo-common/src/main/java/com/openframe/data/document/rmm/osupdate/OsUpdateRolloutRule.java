package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateRolloutRule {

    private OsUpdateRolloutMode mode;

    // Counted from the vendor's release: to the pilot ring, or to every device when the mode has no pilot ring.
    private Integer daysAfterRelease;

    // PILOT_THEN_EVERYONE only: counted from the day the pilot ring got the update.
    private Integer daysLaterToEveryone;
}
